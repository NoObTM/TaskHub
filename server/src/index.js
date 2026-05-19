import crypto from "node:crypto";
import cors from "cors";
import "dotenv/config";
import express from "express";
import http from "node:http";
import { v2 as cloudinary } from "cloudinary";
import { Expo } from "expo-server-sdk";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer } from "socket.io";
import { createStore } from "./store.js";

const app = express();
const port = process.env.PORT ?? 4000;
const jwtSecret = process.env.JWT_SECRET;
const TODO_REMINDER_CHANNEL_ID = "todo-reminders";
if (!jwtSecret) {
  throw new Error("JWT_SECRET ausente. Defina uma chave forte em server/.env.");
}

const store = createStore();
const expo = new Expo();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json({ limit: "8mb" }));

function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
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
  if (!token) return res.status(401).json({ message: "Sessão inválida" });

  try {
    const payload = jwt.verify(token, jwtSecret);
    const userId = payload?.sub;
    if (!userId || !store.isValidId(userId)) {
      return res.status(401).json({ message: "Sessão inválida" });
    }
    const user = await store.findUserById(userId);
    if (!user) return res.status(401).json({ message: "Sessão inválida" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Sessão inválida" });
  }
}

function requireId(res, value, message = "Dados inválidos") {
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
      channelId: TODO_REMINDER_CHANNEL_ID,
    }));

  const chunks = expo.chunkPushNotifications(messages);
  await Promise.all(chunks.map((chunk) => expo.sendPushNotificationsAsync(chunk)));
}

io.on("connection", (socket) => {
  socket.on("auth", ({ token, userId }) => {
    if (token) {
      try {
        const payload = jwt.verify(token, jwtSecret);
        if (payload?.sub) socket.join(`user:${payload.sub}`);
        return;
      } catch {
        return;
      }
    }
    if (userId && store.isValidId(userId)) {
      socket.join(`user:${userId}`);
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

app.post("/auth/register", asyncRoute(async (req, res) => {
  const name = String(req.body.name ?? "").trim();
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");

  if (!name || !email || password.length < 6) {
    return res.status(400).json({ message: "Dados inválidos" });
  }

  const exists = await store.userExistsByEmail(email);
  if (exists) return res.status(409).json({ message: "E-mail já cadastrado" });

  const salt = crypto.randomBytes(16).toString("hex");
  const user = await store.createUser({
    name,
    email,
    salt,
    passwordHash: hashPassword(password, salt),
  });

  res.status(201).json(authResponse(user));
}));

app.post("/auth/login", asyncRoute(async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  const user = await store.findUserByEmail(email);

  if (!user || hashPassword(password, user.salt) !== user.passwordHash) {
    return res.status(401).json({ message: "E-mail ou senha inválidos" });
  }

  res.json(authResponse(user));
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
    return res.status(400).json({ message: "Push token inválido" });
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
    return res.status(400).json({ message: "Usuário inválido" });
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

app.get("/todos/:id/activity", requireAuth, asyncRoute(async (req, res) => {
  if (!requireId(res, req.params.id)) return;
  const authedUserId = getAuthedUserId(req);
  const todo = await store.getVisibleTodo(req.params.id, authedUserId);
  if (!todo) return res.status(404).json({ message: "Tarefa não encontrada" });

  res.json(await store.listActivities(req.params.id));
}));

app.patch("/todos/:id", requireAuth, asyncRoute(async (req, res) => {
  const title = String(req.body.title ?? "").trim();
  if (!title) return res.json(null);
  if (!requireId(res, req.params.id)) return;
  if (!requireId(res, req.body.assigneeId)) return;
  const authedUserId = getAuthedUserId(req);

  const assigneeExists = await store.userExistsById(req.body.assigneeId);
  if (!assigneeExists) return res.status(400).json({ message: "Usuário inválido" });

  const todo = await store.updateTodoByCreator(req.params.id, authedUserId, {
    title,
    assigneeId: req.body.assigneeId,
    priority: req.body.priority,
    dueDate: req.body.dueDate ?? null,
  });

  if (!todo) return res.status(404).json({ message: "Tarefa não encontrada" });
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
      done ? "Tarefa concluída" : "Tarefa reaberta"
    );
    if (todo.creatorId !== authedUserId) {
      sendPushToUsers(
        [todo.creatorId],
        done ? "Tarefa concluída" : "Tarefa reaberta",
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
    return res.status(400).json({ message: "Dados inválidos" });
  }

  const todo = await store.findTodoById(req.params.id);
  if (!todo) return res.status(404).json({ message: "Tarefa não encontrada" });
  if (todo.creatorId !== userId) {
    return res.status(403).json({ message: "Apenas o criador pode excluir" });
  }

  await store.createActivity(todo.id, userId, "deleted", "Tarefa excluída");
  await store.deleteTodoByCreator(req.params.id, userId);
  emitTodosChanged([userId, todo.assigneeId]);
  res.status(204).end();
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Erro interno" });
});

await store.connect();
httpServer.listen(port, () => {
  console.log(`API on http://localhost:${port} using ${store.provider}`);
});
