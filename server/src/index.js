import crypto from "node:crypto";
import cors from "cors";
import "dotenv/config";
import express from "express";
import http from "node:http";
import { v2 as cloudinary } from "cloudinary";
import { Expo } from "expo-server-sdk";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Server as SocketIOServer } from "socket.io";

const app = express();
const port = process.env.PORT ?? 4000;
const jwtSecret = process.env.JWT_SECRET;
const TODO_REMINDER_CHANNEL_ID = "todo-reminders";
if (!jwtSecret) {
  throw new Error("JWT_SECRET ausente. Defina uma chave forte em server/.env.");
}
const expo = new Expo();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json({ limit: "8mb" }));

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    avatarUri: { type: String, default: null },
    pushTokens: { type: [String], default: [] },
    passwordHash: { type: String, required: true },
    salt: { type: String, required: true },
    createdAt: { type: Number, default: () => Date.now() },
  },
  { versionKey: false }
);

const todoSchema = new mongoose.Schema(
  {
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    dueDate: { type: Number, default: null },
    notificationId: { type: String, default: null },
    seen: { type: Boolean, default: false },
    createdAt: { type: Number, default: () => Date.now() },
  },
  { versionKey: false }
);

const activitySchema = new mongoose.Schema(
  {
    todoId: { type: mongoose.Schema.Types.ObjectId, ref: "Todo", required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["created", "updated", "completed", "reopened", "deleted"],
      required: true,
    },
    message: { type: String, required: true },
    createdAt: { type: Number, default: () => Date.now() },
  },
  { versionKey: false }
);

const User = mongoose.model("User", userSchema);
const Todo = mongoose.model("Todo", todoSchema);
const Activity = mongoose.model("Activity", activitySchema);

function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function toUser(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatarUri: user.avatarUri ?? null,
    createdAt: user.createdAt,
  };
}

function signAuthToken(user) {
  return jwt.sign({ sub: String(user._id) }, jwtSecret, { expiresIn: "30d" });
}

function authResponse(user) {
  return { user: toUser(user), token: signAuthToken(user) };
}

function toTodo(todo) {
  if (!todo) return null;
  return {
    id: String(todo._id),
    creatorId: String(todo.creatorId),
    assigneeId: String(todo.assigneeId),
    title: todo.title,
    done: todo.done,
    priority: todo.priority,
    dueDate: todo.dueDate ?? null,
    notificationId: todo.notificationId ?? null,
    seen: todo.seen,
    createdAt: todo.createdAt,
  };
}

function toTodoWithUsers(todo) {
  const base = toTodo(todo);
  return {
    ...base,
    creatorName: todo.creatorId.name,
    creatorAvatarUri: todo.creatorId.avatarUri ?? null,
    assigneeName: todo.assigneeId.name,
    assigneeAvatarUri: todo.assigneeId.avatarUri ?? null,
  };
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
    if (!userId || !isObjectId(userId)) {
      return res.status(401).json({ message: "Sessão inválida" });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ message: "Sessão inválida" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Sessão inválida" });
  }
}

function isObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function requireObjectId(res, value, message = "Dados inválidos") {
  if (!value || !isObjectId(value)) {
    res.status(400).json({ message });
    return false;
  }
  return true;
}

function getAuthedUserId(req) {
  return String(req.user._id);
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

async function createActivity(todoId, actorId, type, message) {
  if (!todoId || !actorId) return;
  await Activity.create({ todoId, actorId, type, message });
}

async function sendPushToUsers(userIds, title, body, data = {}) {
  const users = await User.find({ _id: { $in: userIds } }).select("pushTokens");
  const messages = [];
  for (const user of users) {
    for (const pushToken of user.pushTokens ?? []) {
      if (!Expo.isExpoPushToken(pushToken)) continue;
      messages.push({
        to: pushToken,
        sound: "default",
        title,
        body,
        data,
        channelId: TODO_REMINDER_CHANNEL_ID,
      });
    }
  }

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
    if (userId && isObjectId(userId)) {
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

app.get("/health", (_, res) => res.json({ ok: true }));

app.post("/auth/register", asyncRoute(async (req, res) => {
  const name = String(req.body.name ?? "").trim();
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");

  if (!name || !email || password.length < 6) {
    return res.status(400).json({ message: "Dados inválidos" });
  }

  const exists = await User.exists({ email });
  if (exists) return res.status(409).json({ message: "E-mail já cadastrado" });

  const salt = crypto.randomBytes(16).toString("hex");
  const user = await User.create({
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
  const user = await User.findOne({ email });

  if (!user || hashPassword(password, user.salt) !== user.passwordHash) {
    return res.status(401).json({ message: "E-mail ou senha inválidos" });
  }

  res.json(authResponse(user));
}));

app.get("/users", requireAuth, asyncRoute(async (_, res) => {
  const users = await User.find().sort({ name: 1 });
  res.json(users.map(toUser));
}));

app.get("/users/me", requireAuth, asyncRoute(async (req, res) => {
  res.json(toUser(req.user));
}));

app.get("/users/:id", requireAuth, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.json(null);
  const user = await User.findById(req.params.id);
  res.json(toUser(user));
}));

app.patch("/users/:id/avatar", requireAuth, asyncRoute(async (req, res) => {
  if (String(req.user._id) !== String(req.params.id)) {
    return res.status(403).json({ message: "Acesso negado" });
  }
  const avatarUri = await uploadAvatarIfConfigured(req.body.avatarUri);
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { avatarUri },
    { new: true }
  );
  res.json(toUser(user));
}));

app.post("/users/me/push-token", requireAuth, asyncRoute(async (req, res) => {
  const pushToken = String(req.body.pushToken ?? "");
  if (!Expo.isExpoPushToken(pushToken)) {
    return res.status(400).json({ message: "Push token inválido" });
  }

  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { pushTokens: pushToken },
  });
  res.status(204).end();
}));

app.get("/todos", requireAuth, asyncRoute(async (req, res) => {
  const authedUserId = getAuthedUserId(req);
  const limit = Math.min(Number(req.query.limit ?? 100), 100);
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const search = String(req.query.search ?? "").trim();
  const query = {};
  if (req.query.assigneeId === authedUserId) query.assigneeId = authedUserId;
  if (req.query.creatorId === authedUserId) query.creatorId = authedUserId;
  if (req.query.excludeSelf && req.query.creatorId) {
    query.assigneeId = { $ne: authedUserId };
  }
  if (!query.assigneeId && !query.creatorId) {
    query.$or = [{ assigneeId: authedUserId }, { creatorId: authedUserId }];
  }
  if (search) {
    query.title = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  }

  const todos = await Todo.find(query)
    .populate("creatorId", "name avatarUri")
    .populate("assigneeId", "name avatarUri")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.json(todos.map(toTodoWithUsers));
}));

app.get("/todos/unread", requireAuth, asyncRoute(async (req, res) => {
  const authedUserId = getAuthedUserId(req);
  const todos = await Todo.find({
    assigneeId: authedUserId,
    creatorId: { $ne: authedUserId },
    seen: false,
  })
    .populate("creatorId", "name avatarUri")
    .populate("assigneeId", "name avatarUri")
    .sort({ createdAt: -1 });
  res.json(todos.map(toTodoWithUsers));
}));

app.get("/todos/unread/count", requireAuth, asyncRoute(async (req, res) => {
  const authedUserId = getAuthedUserId(req);
  const count = await Todo.countDocuments({
    assigneeId: authedUserId,
    creatorId: { $ne: authedUserId },
    seen: false,
  });
  res.json({ count });
}));

app.post("/todos", requireAuth, asyncRoute(async (req, res) => {
  const title = String(req.body.title ?? "").trim();
  if (!title) return res.json(null);
  if (!requireObjectId(res, req.body.assigneeId)) return;
  const creatorId = getAuthedUserId(req);

  const [creatorExists, assigneeExists] = await Promise.all([
    User.exists({ _id: creatorId }),
    User.exists({ _id: req.body.assigneeId }),
  ]);
  if (!creatorExists || !assigneeExists) {
    return res.status(400).json({ message: "Usuário inválido" });
  }

  const todo = await Todo.create({
    creatorId,
    assigneeId: req.body.assigneeId,
    title,
    priority: req.body.priority ?? "medium",
    dueDate: req.body.dueDate ?? null,
    seen: creatorId === req.body.assigneeId,
  });

  await createActivity(todo._id, creatorId, "created", "Tarefa criada");
  if (String(todo.assigneeId) !== creatorId) {
    sendPushToUsers([String(todo.assigneeId)], "Nova tarefa", title, {
      todoId: String(todo._id),
    }).catch(console.error);
  }
  emitTodosChanged([String(todo.creatorId), String(todo.assigneeId)]);
  res.status(201).json(toTodo(todo));
}));

app.delete("/todos/completed", requireAuth, asyncRoute(async (req, res) => {
  const authedUserId = getAuthedUserId(req);
  const scope = req.query.scope === "assigned-by-me" ? "assigned-by-me" : "mine";
  const deleteQuery = {
    ...(scope === "mine"
      ? { assigneeId: authedUserId }
      : { creatorId: authedUserId, assigneeId: { $ne: authedUserId } }),
    done: true,
  };
  const todosToDelete = await Todo.find(deleteQuery).select("creatorId assigneeId");
  const result = await Todo.deleteMany({ _id: { $in: todosToDelete.map((todo) => todo._id) } });
  if (result.deletedCount > 0) {
    emitTodosChanged([
      ...new Set([
        authedUserId,
        ...todosToDelete.flatMap((todo) => [String(todo.creatorId), String(todo.assigneeId)]),
      ]),
    ]);
  }
  res.json({ deletedCount: result.deletedCount });
}));

app.patch("/todos/seen", requireAuth, asyncRoute(async (req, res) => {
  const authedUserId = getAuthedUserId(req);
  await Todo.updateMany(
    { assigneeId: authedUserId, seen: false },
    { seen: true }
  );
  emitTodosChanged([authedUserId]);
  res.status(204).end();
}));

app.get("/todos/:id/activity", requireAuth, asyncRoute(async (req, res) => {
  if (!requireObjectId(res, req.params.id)) return;
  const authedUserId = getAuthedUserId(req);
  const todo = await Todo.findOne({
    _id: req.params.id,
    $or: [{ creatorId: authedUserId }, { assigneeId: authedUserId }],
  });
  if (!todo) return res.status(404).json({ message: "Tarefa não encontrada" });

  const activities = await Activity.find({ todoId: req.params.id })
    .populate("actorId", "name avatarUri")
    .sort({ createdAt: -1 })
    .limit(50);

  res.json(
    activities.map((activity) => ({
      id: String(activity._id),
      todoId: String(activity.todoId),
      actorId: String(activity.actorId._id),
      actorName: activity.actorId.name,
      actorAvatarUri: activity.actorId.avatarUri ?? null,
      type: activity.type,
      message: activity.message,
      createdAt: activity.createdAt,
    }))
  );
}));

app.patch("/todos/:id", requireAuth, asyncRoute(async (req, res) => {
  const title = String(req.body.title ?? "").trim();
  if (!title) return res.json(null);
  if (!requireObjectId(res, req.params.id)) return;
  if (!requireObjectId(res, req.body.assigneeId)) return;
  const authedUserId = getAuthedUserId(req);

  const assigneeExists = await User.exists({ _id: req.body.assigneeId });
  if (!assigneeExists) return res.status(400).json({ message: "Usuário inválido" });

  const todo = await Todo.findOneAndUpdate(
    { _id: req.params.id, creatorId: authedUserId },
    {
      title,
      assigneeId: req.body.assigneeId,
      priority: req.body.priority,
      dueDate: req.body.dueDate ?? null,
      notificationId: null,
    },
    { new: true }
  );

  if (!todo) return res.status(404).json({ message: "Tarefa não encontrada" });
  await createActivity(todo._id, authedUserId, "updated", "Tarefa atualizada");
  if (String(todo.assigneeId) !== authedUserId) {
    sendPushToUsers([String(todo.assigneeId)], "Tarefa atualizada", title, {
      todoId: String(todo._id),
    }).catch(console.error);
  }
  emitTodosChanged([String(todo.creatorId), String(todo.assigneeId)]);
  res.json(toTodo(todo));
}));

app.patch("/todos/:id/notification", requireAuth, asyncRoute(async (req, res) => {
  if (!requireObjectId(res, req.params.id)) return;
  const authedUserId = getAuthedUserId(req);
  const todo = await Todo.findOneAndUpdate(
    { _id: req.params.id, assigneeId: authedUserId },
    { notificationId: req.body.notificationId ?? null }
  );
  if (todo) emitTodosChanged([String(todo.creatorId), String(todo.assigneeId)]);
  res.status(204).end();
}));

app.patch("/todos/:id/toggle", requireAuth, asyncRoute(async (req, res) => {
  if (!requireObjectId(res, req.params.id)) return;
  const authedUserId = getAuthedUserId(req);
  const done = Boolean(req.body.done);
  const todo = await Todo.findOneAndUpdate(
    { _id: req.params.id, assigneeId: authedUserId },
    { done, notificationId: null }
    , { new: true }
  );
  if (todo) {
    await createActivity(
      todo._id,
      authedUserId,
      done ? "completed" : "reopened",
      done ? "Tarefa concluída" : "Tarefa reaberta"
    );
    if (String(todo.creatorId) !== authedUserId) {
      sendPushToUsers(
        [String(todo.creatorId)],
        done ? "Tarefa concluída" : "Tarefa reaberta",
        todo.title,
        { todoId: String(todo._id) }
      ).catch(console.error);
    }
    emitTodosChanged([String(todo.creatorId), String(todo.assigneeId)]);
  }
  res.status(204).end();
}));

app.delete("/todos/:id", requireAuth, asyncRoute(async (req, res) => {
  const userId = getAuthedUserId(req);
  if (!isObjectId(req.params.id) || !isObjectId(userId)) {
    return res.status(400).json({ message: "Dados inválidos" });
  }

  const todo = await Todo.findById(req.params.id).select("creatorId assigneeId");
  if (!todo) return res.status(404).json({ message: "Tarefa não encontrada" });
  if (String(todo.creatorId) !== String(userId)) {
    return res.status(403).json({ message: "Apenas o criador pode excluir" });
  }

  await createActivity(todo._id, userId, "deleted", "Tarefa excluída");
  await Todo.deleteOne({ _id: req.params.id, creatorId: userId });
  emitTodosChanged([String(userId), String(todo.assigneeId)]);
  res.status(204).end();
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Erro interno" });
});

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI ausente. Crie server/.env com sua connection string.");
}

await mongoose.connect(process.env.MONGODB_URI);
httpServer.listen(port, () => {
  console.log(`API on http://localhost:${port}`);
});
