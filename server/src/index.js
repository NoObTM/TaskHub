import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import cors from "cors";
import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import http from "node:http";
import { v2 as cloudinary } from "cloudinary";
import { Expo } from "expo-server-sdk";
import jwt from "jsonwebtoken";
import twilio from "twilio";
import { Server as SocketIOServer } from "socket.io";
import { createStore } from "./store.js";

const app = express();
app.set("trust proxy", 1);
const port = process.env.PORT ?? 4000;
const jwtSecret = process.env.JWT_SECRET;
const TODO_REMINDER_CHANNEL_ID = "todo-reminders";
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioVerifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
if (!jwtSecret) {
  throw new Error("JWT_SECRET ausente. Defina uma chave forte em server/.env.");
}

const store = createStore();
const expo = new Expo();
const twilioVerifyClient = twilioAccountSid && twilioAuthToken && twilioVerifyServiceSid
  ? twilio(twilioAccountSid, twilioAuthToken)
  : null;
const passwordResetRequests = new Map();
const httpServer = http.createServer(app);
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origem nao permitida pelo CORS"));
  },
};
const io = new SocketIOServer(httpServer, {
  cors: allowedOrigins.length > 0 ? { origin: allowedOrigins } : { origin: "*" },
});

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "8mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitas tentativas de redefinicao. Tente novamente em alguns minutos." },
});

function legacyHashPassword(password, salt) {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password, user) {
  if (!user?.passwordHash) return false;
  if (user.passwordHash.startsWith("$2")) {
    return bcrypt.compare(password, user.passwordHash);
  }
  return legacyHashPassword(password, user.salt) === user.passwordHash;
}

function hashResetCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function createResetCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function normalizePhoneNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("00")) return `+${cleaned.slice(2).replace(/\D/g, "")}`;
  if (cleaned.startsWith("+")) return `+${cleaned.slice(1).replace(/\D/g, "")}`;

  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

function isValidPhoneNumber(phone) {
  return /^\+[1-9]\d{9,14}$/.test(phone);
}

function maskPhone(phone) {
  return phone ? `${phone.slice(0, 3)}***${phone.slice(-4)}` : "";
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUri: user.avatarUri ?? null,
    createdAt: user.createdAt,
  };
}

function signAuthToken(user) {
  return jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: "30d" });
}

function authResponse(user) {
  return { user: publicUser(user), token: signAuthToken(user) };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Sessao invalida" });

  try {
    const payload = jwt.verify(token, jwtSecret);
    const userId = payload?.sub;
    if (!userId || !store.isValidId(userId)) {
      return res.status(401).json({ message: "Sessao invalida" });
    }
    const user = await store.findUserById(userId);
    if (!user) return res.status(401).json({ message: "Sessao invalida" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Sessao invalida" });
  }
}

function requireId(res, value, message = "Dados invalidos") {
  if (!value || !store.isValidId(value)) {
    res.status(400).json({ message });
    return false;
  }
  return true;
}

function getAuthedUserId(req) {
  return req.user.id;
}

async function uploadAvatarIfConfigured(avatarUri) {
  if (!avatarUri?.startsWith("data:image/")) return avatarUri ?? null;
  if (avatarUri.length > 2_000_000) {
    throw new Error("Avatar muito grande");
  }
  if (!process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_CLOUD_NAME) {
    return avatarUri;
  }

  const result = await cloudinary.uploader.upload(avatarUri, {
    folder: "todo-app/avatars",
    resource_type: "image",
    transformation: [
      { width: 256, height: 256, crop: "fill", gravity: "face" },
      { quality: "auto", fetch_format: "auto" },
    ],
  });
  return result.secure_url;
}

async function sendPushToUsers(userIds, title, body, data = {}) {
  const pushTokens = await store.getPushTokensByUserIds(userIds);
  const messages = pushTokens
    .filter((pushToken) => Expo.isExpoPushToken(pushToken))
    .map((pushToken) => ({
      to: pushToken,
      sound: "default",
      title,
      body,
      data,
      priority: "high",
      channelId: TODO_REMINDER_CHANNEL_ID,
    }));

  const chunks = expo.chunkPushNotifications(messages);
  const ticketChunks = await Promise.all(chunks.map((chunk) => expo.sendPushNotificationsAsync(chunk)));
  const receiptIds = [];
  for (const ticket of ticketChunks.flat()) {
    if (ticket.status === "ok" && ticket.id) {
      receiptIds.push(ticket.id);
    } else if (ticket.status === "error") {
      console.error("Expo push ticket error", ticket.message, ticket.details);
    }
  }

  const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
  const receipts = await Promise.all(
    receiptChunks.map((chunk) => expo.getPushNotificationReceiptsAsync(chunk))
  );
  for (const receipt of Object.values(Object.assign({}, ...receipts))) {
    if (receipt.status === "error") {
      console.error("Expo push receipt error", receipt.message, receipt.details);
    }
  }
}

async function sendPasswordResetCode(phone, resetCode) {
  if (!twilioVerifyClient) {
    console.info(`[password-reset] Codigo para ${phone}: ${resetCode} (expira em 15 min)`);
    return;
  }

  const verification = await twilioVerifyClient.verify.v2
    .services(twilioVerifyServiceSid)
    .verifications.create({
      channel: "sms",
      to: phone,
    });
  console.info(
    `[password-reset] Twilio Verify solicitado para ${maskPhone(phone)}: ${verification.sid} (${verification.status})`
  );
}

async function verifyPasswordResetCode(phone, resetCode) {
  if (!twilioVerifyClient) return null;

  let verificationCheck;
  try {
    verificationCheck = await twilioVerifyClient.verify.v2
      .services(twilioVerifyServiceSid)
      .verificationChecks.create({
        code: resetCode,
        to: phone,
      });
  } catch (error) {
    if (error?.status === 404 || error?.code === 20404) {
      console.warn(`[password-reset] Twilio Verify nao encontrou verificacao ativa para ${maskPhone(phone)}`);
      return false;
    }
    throw error;
  }

  return verificationCheck.status === "approved" || verificationCheck.valid === true;
}

io.on("connection", (socket) => {
  socket.on("auth", ({ token }) => {
    try {
      const payload = jwt.verify(String(token ?? ""), jwtSecret);
      if (payload?.sub) socket.join(`user:${payload.sub}`);
    } catch {
      socket.disconnect(true);
    }
  });
});

function emitTodosChanged(userIds) {
  for (const userId of userIds) {
    if (!userId) continue;
    io.to(`user:${userId}`).emit("todos:changed");
  }
}

app.get("/health", (_, res) => res.json({ ok: true, db: store.provider }));

app.post("/auth/register", authLimiter, asyncRoute(async (req, res) => {
  const name = String(req.body.name ?? "").trim();
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const phone = normalizePhoneNumber(req.body.phone);
  const password = String(req.body.password ?? "");

  if (!name || !email || !isValidPhoneNumber(phone) || password.length < 6) {
    return res.status(400).json({ message: "Dados invalidos" });
  }

  const [emailExists, phoneExists] = await Promise.all([
    store.userExistsByEmail(email),
    store.userExistsByPhone(phone),
  ]);
  if (emailExists) return res.status(409).json({ message: "E-mail ja cadastrado" });
  if (phoneExists) return res.status(409).json({ message: "Telefone ja cadastrado" });

  const user = await store.createUser({
    name,
    email,
    phone,
    salt: "bcrypt",
    passwordHash: await hashPassword(password),
  });

  res.status(201).json(authResponse(user));
}));

app.post("/auth/login", authLimiter, asyncRoute(async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  const user = await store.findUserByEmail(email);

  if (!user || !(await verifyPassword(password, user))) {
    return res.status(401).json({ message: "E-mail ou senha invalidos" });
  }

  let currentUser = user;
  if (!user.passwordHash.startsWith("$2")) {
    currentUser = await store.updateUserPasswordByEmail(email, "bcrypt", await hashPassword(password));
  }

  res.json(authResponse(currentUser));
}));

app.post("/auth/reset-password/request", resetLimiter, asyncRoute(async (req, res) => {
  const phone = normalizePhoneNumber(req.body.phone);

  if (!isValidPhoneNumber(phone)) {
    return res.status(400).json({ message: "Dados invalidos" });
  }

  const user = await store.findUserByPhone(phone);

  if (user) {
    const now = Date.now();
    const lastRequestAt = passwordResetRequests.get(phone) ?? 0;
    const persistedLastRequestAt = user.passwordResetExpiresAt
      ? user.passwordResetExpiresAt - PASSWORD_RESET_TTL_MS
      : 0;
    if (
      now - lastRequestAt < PASSWORD_RESET_RESEND_COOLDOWN_MS ||
      now - persistedLastRequestAt < PASSWORD_RESET_RESEND_COOLDOWN_MS
    ) {
      console.info(`[password-reset] Reenvio bloqueado por cooldown para ${maskPhone(phone)}`);
      return res.status(204).end();
    }
    passwordResetRequests.set(phone, now);

    const resetCode = createResetCode();
    await store.setPasswordResetCodeByPhone(
      phone,
      twilioVerifyClient ? null : hashResetCode(resetCode),
      now + PASSWORD_RESET_TTL_MS
    );
    sendPasswordResetCode(phone, resetCode).catch((error) => {
      console.error("Erro ao enviar codigo de reset por SMS", error);
    });
  }

  res.status(204).end();
}));

app.patch("/auth/reset-password", resetLimiter, asyncRoute(async (req, res) => {
  const phone = normalizePhoneNumber(req.body.phone);
  const resetCode = String(req.body.resetCode ?? "").trim();
  const password = String(req.body.password ?? "");

  if (!isValidPhoneNumber(phone) || !/^\d{6}$/.test(resetCode) || password.length < 6) {
    return res.status(400).json({ message: "Dados invalidos" });
  }

  const passwordHash = await hashPassword(password);
  const twilioApproved = await verifyPasswordResetCode(phone, resetCode);
  const user = twilioApproved === null
    ? await store.updateUserPasswordByResetCodeByPhone(
        phone,
        hashResetCode(resetCode),
        "bcrypt",
        passwordHash,
        Date.now()
      )
    : twilioApproved
      ? await store.updateUserPasswordByPhone(phone, "bcrypt", passwordHash)
      : null;

  if (!user) return res.status(400).json({ message: "Codigo invalido ou expirado" });
  res.status(204).end();
}));

app.get("/users", requireAuth, asyncRoute(async (_, res) => {
  const users = await store.listUsers();
  res.json(users.map(publicUser));
}));

app.get("/users/me", requireAuth, asyncRoute(async (req, res) => {
  res.json(publicUser(req.user));
}));

app.get("/users/:id", requireAuth, asyncRoute(async (req, res) => {
  if (!store.isValidId(req.params.id)) return res.json(null);
  const user = await store.findUserById(req.params.id);
  res.json(publicUser(user));
}));

app.patch("/users/:id/avatar", requireAuth, asyncRoute(async (req, res) => {
  if (req.user.id !== req.params.id) {
    return res.status(403).json({ message: "Acesso negado" });
  }
  const avatarUri = await uploadAvatarIfConfigured(req.body.avatarUri);
  const user = await store.updateUserAvatar(req.params.id, avatarUri);
  res.json(publicUser(user));
}));

app.post("/users/me/push-token", requireAuth, asyncRoute(async (req, res) => {
  const pushToken = String(req.body.pushToken ?? "");
  if (!Expo.isExpoPushToken(pushToken)) {
    return res.status(400).json({ message: "Push token invalido" });
  }

  await store.addPushToken(req.user.id, pushToken);
  res.status(204).end();
}));

app.get("/todos", requireAuth, asyncRoute(async (req, res) => {
  const authedUserId = getAuthedUserId(req);
  const limit = Math.min(Number(req.query.limit ?? 100), 100);
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const search = String(req.query.search ?? "").trim();

  const todos = await store.listTodos({
    authedUserId,
    assigneeId: req.query.assigneeId,
    creatorId: req.query.creatorId,
    excludeSelf: Boolean(req.query.excludeSelf),
    search,
    limit,
    page,
  });
  res.json(todos);
}));

app.get("/todos/unread", requireAuth, asyncRoute(async (req, res) => {
  const todos = await store.listUnread(getAuthedUserId(req));
  res.json(todos);
}));

app.get("/todos/unread/count", requireAuth, asyncRoute(async (req, res) => {
  const count = await store.countUnread(getAuthedUserId(req));
  res.json({ count });
}));

app.post("/todos", requireAuth, asyncRoute(async (req, res) => {
  const title = String(req.body.title ?? "").trim();
  if (!title) return res.json(null);
  if (!requireId(res, req.body.assigneeId)) return;
  const creatorId = getAuthedUserId(req);

  const [creatorExists, assigneeExists] = await Promise.all([
    store.userExistsById(creatorId),
    store.userExistsById(req.body.assigneeId),
  ]);
  if (!creatorExists || !assigneeExists) {
    return res.status(400).json({ message: "Usuario invalido" });
  }

  const todo = await store.createTodo({
    creatorId,
    assigneeId: req.body.assigneeId,
    title,
    priority: req.body.priority ?? "medium",
    dueDate: req.body.dueDate ?? null,
    seen: creatorId === req.body.assigneeId,
  });

  await store.createActivity(todo.id, creatorId, "created", "Tarefa criada");
  if (todo.assigneeId !== creatorId) {
    sendPushToUsers([todo.assigneeId], "Nova tarefa", title, {
      todoId: todo.id,
    }).catch(console.error);
  }
  emitTodosChanged([todo.creatorId, todo.assigneeId]);
  res.status(201).json(todo);
}));

app.delete("/todos/completed", requireAuth, asyncRoute(async (req, res) => {
  const result = await store.clearCompleted(
    getAuthedUserId(req),
    req.query.scope === "assigned-by-me" ? "assigned-by-me" : "mine"
  );
  if (result.deletedCount > 0) emitTodosChanged(result.affectedUserIds);
  res.json({ deletedCount: result.deletedCount });
}));

app.patch("/todos/seen", requireAuth, asyncRoute(async (req, res) => {
  const authedUserId = getAuthedUserId(req);
  await store.markAllAsSeen(authedUserId);
  emitTodosChanged([authedUserId]);
  res.status(204).end();
}));

app.patch("/todos/reorder", requireAuth, asyncRoute(async (req, res) => {
  const todoIds = Array.isArray(req.body.todoIds)
    ? req.body.todoIds.filter((id) => store.isValidId(id))
    : [];
  if (todoIds.length === 0) return res.status(400).json({ message: "Dados invalidos" });

  const result = await store.reorderTodos(getAuthedUserId(req), todoIds);
  emitTodosChanged(result.affectedUserIds);
  res.status(204).end();
}));

app.get("/todos/:id/activity", requireAuth, asyncRoute(async (req, res) => {
  if (!requireId(res, req.params.id)) return;
  const authedUserId = getAuthedUserId(req);
  const todo = await store.getVisibleTodo(req.params.id, authedUserId);
  if (!todo) return res.status(404).json({ message: "Tarefa nao encontrada" });

  res.json(await store.listActivities(req.params.id));
}));

app.patch("/todos/:id", requireAuth, asyncRoute(async (req, res) => {
  const title = String(req.body.title ?? "").trim();
  if (!title) return res.json(null);
  if (!requireId(res, req.params.id)) return;
  const authedUserId = getAuthedUserId(req);
  const existingTodo = await store.findTodoById(req.params.id);

  if (!existingTodo) return res.status(404).json({ message: "Tarefa nao encontrada" });
  if (existingTodo.creatorId !== authedUserId) {
    return res.status(403).json({ message: "Apenas o criador pode editar" });
  }

  const assigneeId = store.isValidId(req.body.assigneeId)
    ? req.body.assigneeId
    : existingTodo.assigneeId;
  const assigneeExists = await store.userExistsById(assigneeId);
  if (!assigneeExists) return res.status(400).json({ message: "Usuario invalido" });

  const todo = await store.updateTodoByCreator(req.params.id, authedUserId, {
    title,
    assigneeId,
    priority: req.body.priority,
    dueDate: req.body.dueDate ?? null,
  });

  if (!todo) return res.status(404).json({ message: "Tarefa nao encontrada" });
  await store.createActivity(todo.id, authedUserId, "updated", "Tarefa atualizada");
  if (todo.assigneeId !== authedUserId) {
    sendPushToUsers([todo.assigneeId], "Tarefa atualizada", title, {
      todoId: todo.id,
    }).catch(console.error);
  }
  emitTodosChanged([todo.creatorId, todo.assigneeId]);
  res.json(todo);
}));

app.patch("/todos/:id/notification", requireAuth, asyncRoute(async (req, res) => {
  if (!requireId(res, req.params.id)) return;
  const todo = await store.updateNotificationByAssignee(
    req.params.id,
    getAuthedUserId(req),
    req.body.notificationId ?? null
  );
  if (todo) emitTodosChanged([todo.creatorId, todo.assigneeId]);
  res.status(204).end();
}));

app.patch("/todos/:id/toggle", requireAuth, asyncRoute(async (req, res) => {
  if (!requireId(res, req.params.id)) return;
  const authedUserId = getAuthedUserId(req);
  const done = Boolean(req.body.done);
  const todo = await store.toggleTodoByAssignee(req.params.id, authedUserId, done);
  if (todo) {
    await store.createActivity(
      todo.id,
      authedUserId,
      done ? "completed" : "reopened",
      done ? "Tarefa concluida" : "Tarefa reaberta"
    );
    if (todo.creatorId !== authedUserId) {
      sendPushToUsers(
        [todo.creatorId],
        done ? "Tarefa concluida" : "Tarefa reaberta",
        todo.title,
        { todoId: todo.id }
      ).catch(console.error);
    }
    emitTodosChanged([todo.creatorId, todo.assigneeId]);
  }
  res.status(204).end();
}));

app.delete("/todos/:id", requireAuth, asyncRoute(async (req, res) => {
  const userId = getAuthedUserId(req);
  if (!store.isValidId(req.params.id) || !store.isValidId(userId)) {
    return res.status(400).json({ message: "Dados invalidos" });
  }

  const todo = await store.findTodoById(req.params.id);
  if (!todo) return res.status(404).json({ message: "Tarefa nao encontrada" });
  if (todo.creatorId !== userId) {
    return res.status(403).json({ message: "Apenas o criador pode excluir" });
  }

  await store.createActivity(todo.id, userId, "deleted", "Tarefa excluida");
  await store.deleteTodoByCreator(req.params.id, userId);
  emitTodosChanged([userId, todo.assigneeId]);
  res.status(204).end();
}));

app.use((_req, res) => {
  res.status(404).json({ message: "Rota nao encontrada" });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Erro interno" });
});

await store.connect();
httpServer.listen(port, () => {
  console.log(`API on http://localhost:${port} using ${store.provider}`);
});
