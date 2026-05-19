import { createClient } from "@supabase/supabase-js";
import mongoose from "mongoose";

const USER_FIELDS = "id, name, email, avatar_uri, push_tokens, password_hash, salt, created_at";
const TODO_FIELDS = "id, creator_id, assignee_id, title, done, completed_at, priority, due_date, notification_id, seen, created_at";
const ACTIVITY_FIELDS = "id, todo_id, actor_id, type, message, created_at";

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
    completedAt: { type: Number, default: null },
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

function mapMongoUser(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatarUri: user.avatarUri ?? null,
    pushTokens: user.pushTokens ?? [],
    passwordHash: user.passwordHash,
    salt: user.salt,
    createdAt: user.createdAt,
  };
}

function mapMongoTodo(todo) {
  if (!todo) return null;
  return {
    id: String(todo._id),
    creatorId: String(todo.creatorId),
    assigneeId: String(todo.assigneeId),
    title: todo.title,
    done: todo.done,
    completedAt: todo.completedAt ?? null,
    priority: todo.priority,
    dueDate: todo.dueDate ?? null,
    notificationId: todo.notificationId ?? null,
    seen: todo.seen,
    createdAt: todo.createdAt,
  };
}

function mapMongoTodoWithUsers(todo) {
  const base = mapMongoTodo(todo);
  return {
    ...base,
    creatorName: todo.creatorId.name,
    creatorAvatarUri: todo.creatorId.avatarUri ?? null,
    assigneeName: todo.assigneeId.name,
    assigneeAvatarUri: todo.assigneeId.avatarUri ?? null,
  };
}

function mapMongoActivity(activity) {
  return {
    id: String(activity._id),
    todoId: String(activity.todoId),
    actorId: String(activity.actorId._id),
    actorName: activity.actorId.name,
    actorAvatarUri: activity.actorId.avatarUri ?? null,
    type: activity.type,
    message: activity.message,
    createdAt: activity.createdAt,
  };
}

function mapSupabaseUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUri: user.avatar_uri ?? null,
    pushTokens: user.push_tokens ?? [],
    passwordHash: user.password_hash,
    salt: user.salt,
    createdAt: Number(user.created_at),
  };
}

function mapSupabaseTodo(todo) {
  if (!todo) return null;
  return {
    id: todo.id,
    creatorId: todo.creator_id,
    assigneeId: todo.assignee_id,
    title: todo.title,
    done: todo.done,
    completedAt: todo.completed_at == null ? null : Number(todo.completed_at),
    priority: todo.priority,
    dueDate: todo.due_date == null ? null : Number(todo.due_date),
    notificationId: todo.notification_id ?? null,
    seen: todo.seen,
    createdAt: Number(todo.created_at),
  };
}

function mapSupabaseActivity(activity, actor) {
  return {
    id: activity.id,
    todoId: activity.todo_id,
    actorId: activity.actor_id,
    actorName: actor?.name ?? "",
    actorAvatarUri: actor?.avatarUri ?? null,
    type: activity.type,
    message: activity.message,
    createdAt: Number(activity.created_at),
  };
}

function toSupabaseTodoInsert(input) {
  return {
    creator_id: input.creatorId,
    assignee_id: input.assigneeId,
    title: input.title,
    priority: input.priority ?? "medium",
    due_date: input.dueDate ?? null,
    seen: input.seen ?? false,
  };
}

async function hydrateSupabaseTodos(client, rows) {
  const userIds = [...new Set(rows.flatMap((todo) => [todo.creator_id, todo.assignee_id]))];
  const { data: users, error } = await client
    .from("users")
    .select(USER_FIELDS)
    .in("id", userIds);
  if (error) throw error;

  const usersById = new Map((users ?? []).map((user) => [user.id, mapSupabaseUser(user)]));
  return rows.map((row) => {
    const base = mapSupabaseTodo(row);
    const creator = usersById.get(row.creator_id);
    const assignee = usersById.get(row.assignee_id);
    return {
      ...base,
      creatorName: creator?.name ?? "",
      creatorAvatarUri: creator?.avatarUri ?? null,
      assigneeName: assignee?.name ?? "",
      assigneeAvatarUri: assignee?.avatarUri ?? null,
    };
  });
}

function createMongoStore() {
  return {
    provider: "mongodb",
    isValidId: (value) => mongoose.isValidObjectId(value),
    connect: async () => {
      if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI ausente. Crie server/.env com sua connection string.");
      }
      await mongoose.connect(process.env.MONGODB_URI);
    },
    findUserById: async (id) => mapMongoUser(await User.findById(id)),
    findUserByEmail: async (email) => mapMongoUser(await User.findOne({ email })),
    userExistsById: async (id) => Boolean(await User.exists({ _id: id })),
    userExistsByEmail: async (email) => Boolean(await User.exists({ email })),
    createUser: async ({ name, email, salt, passwordHash }) =>
      mapMongoUser(await User.create({ name, email, salt, passwordHash })),
    listUsers: async () => (await User.find().sort({ name: 1 })).map(mapMongoUser),
    updateUserAvatar: async (id, avatarUri) =>
      mapMongoUser(await User.findByIdAndUpdate(id, { avatarUri }, { new: true })),
    addPushToken: async (id, pushToken) => {
      await User.findByIdAndUpdate(id, { $addToSet: { pushTokens: pushToken } });
    },
    getPushTokensByUserIds: async (ids) =>
      (await User.find({ _id: { $in: ids } }).select("pushTokens")).flatMap((user) => user.pushTokens ?? []),
    listTodos: async ({ authedUserId, assigneeId, creatorId, excludeSelf, search, limit, page }) => {
      const query = {};
      if (assigneeId === authedUserId) query.assigneeId = authedUserId;
      if (creatorId === authedUserId) query.creatorId = authedUserId;
      if (excludeSelf && creatorId) query.assigneeId = { $ne: authedUserId };
      if (!query.assigneeId && !query.creatorId) {
        query.$or = [{ assigneeId: authedUserId }, { creatorId: authedUserId }];
      }
      if (search) query.title = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

      return (await Todo.find(query)
        .populate("creatorId", "name avatarUri")
        .populate("assigneeId", "name avatarUri")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)).map(mapMongoTodoWithUsers);
    },
    listUnread: async (authedUserId) =>
      (await Todo.find({ assigneeId: authedUserId, creatorId: { $ne: authedUserId }, seen: false })
        .populate("creatorId", "name avatarUri")
        .populate("assigneeId", "name avatarUri")
        .sort({ createdAt: -1 })).map(mapMongoTodoWithUsers),
    countUnread: async (authedUserId) =>
      Todo.countDocuments({ assigneeId: authedUserId, creatorId: { $ne: authedUserId }, seen: false }),
    createTodo: async (input) => mapMongoTodo(await Todo.create(input)),
    clearCompleted: async (authedUserId, scope) => {
      const deleteQuery = {
        ...(scope === "mine"
          ? { assigneeId: authedUserId }
          : { creatorId: authedUserId, assigneeId: { $ne: authedUserId } }),
        done: true,
      };
      const todosToDelete = await Todo.find(deleteQuery).select("creatorId assigneeId");
      const result = await Todo.deleteMany({ _id: { $in: todosToDelete.map((todo) => todo._id) } });
      return {
        deletedCount: result.deletedCount,
        affectedUserIds: [...new Set([authedUserId, ...todosToDelete.flatMap((todo) => [String(todo.creatorId), String(todo.assigneeId)])])],
      };
    },
    markAllAsSeen: async (authedUserId) => {
      await Todo.updateMany({ assigneeId: authedUserId, seen: false }, { seen: true });
    },
    getVisibleTodo: async (todoId, authedUserId) =>
      mapMongoTodo(await Todo.findOne({ _id: todoId, $or: [{ creatorId: authedUserId }, { assigneeId: authedUserId }] })),
    listActivities: async (todoId) =>
      (await Activity.find({ todoId }).populate("actorId", "name avatarUri").sort({ createdAt: -1 }).limit(50)).map(mapMongoActivity),
    updateTodoByCreator: async (todoId, authedUserId, input) =>
      mapMongoTodo(await Todo.findOneAndUpdate(
        { _id: todoId, creatorId: authedUserId },
        {
          title: input.title,
          assigneeId: input.assigneeId,
          priority: input.priority,
          dueDate: input.dueDate ?? null,
          notificationId: null,
        },
        { new: true }
      )),
    updateNotificationByAssignee: async (todoId, authedUserId, notificationId) =>
      mapMongoTodo(await Todo.findOneAndUpdate({ _id: todoId, assigneeId: authedUserId }, { notificationId }, { new: true })),
    toggleTodoByAssignee: async (todoId, authedUserId, done) =>
      mapMongoTodo(await Todo.findOneAndUpdate(
        { _id: todoId, assigneeId: authedUserId },
        { done, completedAt: done ? Date.now() : null, notificationId: null },
        { new: true }
      )),
    findTodoById: async (todoId) => mapMongoTodo(await Todo.findById(todoId).select("creatorId assigneeId")),
    deleteTodoByCreator: async (todoId, userId) => {
      await Todo.deleteOne({ _id: todoId, creatorId: userId });
    },
    createActivity: async (todoId, actorId, type, message) => {
      if (!todoId || !actorId) return;
      await Activity.create({ todoId, actorId, type, message });
    },
  };
}

function createSupabaseStore() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios com DB_PROVIDER=supabase.");
  }
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const single = async (query) => {
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  };

  return {
    provider: "supabase",
    isValidId: (value) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value)),
    connect: async () => {
      const { error } = await client.from("users").select("id").limit(1);
      if (error) throw error;
    },
    findUserById: async (id) => mapSupabaseUser(await single(client.from("users").select(USER_FIELDS).eq("id", id))),
    findUserByEmail: async (email) => mapSupabaseUser(await single(client.from("users").select(USER_FIELDS).eq("email", email))),
    userExistsById: async (id) => Boolean(await single(client.from("users").select("id").eq("id", id))),
    userExistsByEmail: async (email) => Boolean(await single(client.from("users").select("id").eq("email", email))),
    createUser: async ({ name, email, salt, passwordHash }) => {
      const { data, error } = await client
        .from("users")
        .insert({ name, email, salt, password_hash: passwordHash })
        .select(USER_FIELDS)
        .single();
      if (error) throw error;
      return mapSupabaseUser(data);
    },
    listUsers: async () => {
      const { data, error } = await client.from("users").select(USER_FIELDS).order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapSupabaseUser);
    },
    updateUserAvatar: async (id, avatarUri) => {
      const { data, error } = await client.from("users").update({ avatar_uri: avatarUri }).eq("id", id).select(USER_FIELDS).single();
      if (error) throw error;
      return mapSupabaseUser(data);
    },
    addPushToken: async (id, pushToken) => {
      const user = await single(client.from("users").select("push_tokens").eq("id", id));
      const pushTokens = [...new Set([...(user?.push_tokens ?? []), pushToken])];
      const { error } = await client.from("users").update({ push_tokens: pushTokens }).eq("id", id);
      if (error) throw error;
    },
    getPushTokensByUserIds: async (ids) => {
      const { data, error } = await client.from("users").select("push_tokens").in("id", ids);
      if (error) throw error;
      return (data ?? []).flatMap((user) => user.push_tokens ?? []);
    },
    listTodos: async ({ authedUserId, assigneeId, creatorId, excludeSelf, search, limit, page }) => {
      let query = client.from("todos").select(TODO_FIELDS);
      if (assigneeId === authedUserId) query = query.eq("assignee_id", authedUserId);
      if (creatorId === authedUserId) query = query.eq("creator_id", authedUserId);
      if (excludeSelf && creatorId) query = query.neq("assignee_id", authedUserId);
      if (assigneeId !== authedUserId && creatorId !== authedUserId) {
        query = query.or(`assignee_id.eq.${authedUserId},creator_id.eq.${authedUserId}`);
      }
      if (search) query = query.ilike("title", `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
      const from = (page - 1) * limit;
      const { data, error } = await query.order("created_at", { ascending: false }).range(from, from + limit - 1);
      if (error) throw error;
      return hydrateSupabaseTodos(client, data ?? []);
    },
    listUnread: async (authedUserId) => {
      const { data, error } = await client
        .from("todos")
        .select(TODO_FIELDS)
        .eq("assignee_id", authedUserId)
        .neq("creator_id", authedUserId)
        .eq("seen", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return hydrateSupabaseTodos(client, data ?? []);
    },
    countUnread: async (authedUserId) => {
      const { count, error } = await client
        .from("todos")
        .select("id", { count: "exact", head: true })
        .eq("assignee_id", authedUserId)
        .neq("creator_id", authedUserId)
        .eq("seen", false);
      if (error) throw error;
      return count ?? 0;
    },
    createTodo: async (input) => {
      const { data, error } = await client.from("todos").insert(toSupabaseTodoInsert(input)).select(TODO_FIELDS).single();
      if (error) throw error;
      return mapSupabaseTodo(data);
    },
    clearCompleted: async (authedUserId, scope) => {
      let selectQuery = client.from("todos").select("id, creator_id, assignee_id").eq("done", true);
      if (scope === "mine") selectQuery = selectQuery.eq("assignee_id", authedUserId);
      else selectQuery = selectQuery.eq("creator_id", authedUserId).neq("assignee_id", authedUserId);
      const { data: todosToDelete, error: selectError } = await selectQuery;
      if (selectError) throw selectError;
      const ids = (todosToDelete ?? []).map((todo) => todo.id);
      if (ids.length > 0) {
        const { error } = await client.from("todos").delete().in("id", ids);
        if (error) throw error;
      }
      return {
        deletedCount: ids.length,
        affectedUserIds: [...new Set([authedUserId, ...(todosToDelete ?? []).flatMap((todo) => [todo.creator_id, todo.assignee_id])])],
      };
    },
    markAllAsSeen: async (authedUserId) => {
      const { error } = await client.from("todos").update({ seen: true }).eq("assignee_id", authedUserId).eq("seen", false);
      if (error) throw error;
    },
    getVisibleTodo: async (todoId, authedUserId) =>
      mapSupabaseTodo(await single(client.from("todos").select(TODO_FIELDS).eq("id", todoId).or(`creator_id.eq.${authedUserId},assignee_id.eq.${authedUserId}`))),
    listActivities: async (todoId) => {
      const { data, error } = await client.from("activities").select(ACTIVITY_FIELDS).eq("todo_id", todoId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      const actorIds = [...new Set((data ?? []).map((activity) => activity.actor_id))];
      const { data: users, error: userError } = await client.from("users").select(USER_FIELDS).in("id", actorIds);
      if (userError) throw userError;
      const usersById = new Map((users ?? []).map((user) => [user.id, mapSupabaseUser(user)]));
      return (data ?? []).map((activity) => mapSupabaseActivity(activity, usersById.get(activity.actor_id)));
    },
    updateTodoByCreator: async (todoId, authedUserId, input) => {
      const { data, error } = await client
        .from("todos")
        .update({
          title: input.title,
          assignee_id: input.assigneeId,
          priority: input.priority,
          due_date: input.dueDate ?? null,
          notification_id: null,
        })
        .eq("id", todoId)
        .eq("creator_id", authedUserId)
        .select(TODO_FIELDS)
        .maybeSingle();
      if (error) throw error;
      return mapSupabaseTodo(data);
    },
    updateNotificationByAssignee: async (todoId, authedUserId, notificationId) => {
      const { data, error } = await client
        .from("todos")
        .update({ notification_id: notificationId })
        .eq("id", todoId)
        .eq("assignee_id", authedUserId)
        .select(TODO_FIELDS)
        .maybeSingle();
      if (error) throw error;
      return mapSupabaseTodo(data);
    },
    toggleTodoByAssignee: async (todoId, authedUserId, done) => {
      const { data, error } = await client
        .from("todos")
        .update({ done, completed_at: done ? Date.now() : null, notification_id: null })
        .eq("id", todoId)
        .eq("assignee_id", authedUserId)
        .select(TODO_FIELDS)
        .maybeSingle();
      if (error) throw error;
      return mapSupabaseTodo(data);
    },
    findTodoById: async (todoId) => mapSupabaseTodo(await single(client.from("todos").select(TODO_FIELDS).eq("id", todoId))),
    deleteTodoByCreator: async (todoId, userId) => {
      const { error } = await client.from("todos").delete().eq("id", todoId).eq("creator_id", userId);
      if (error) throw error;
    },
    createActivity: async (todoId, actorId, type, message) => {
      if (!todoId || !actorId) return;
      const { error } = await client.from("activities").insert({ todo_id: todoId, actor_id: actorId, type, message });
      if (error) throw error;
    },
  };
}

export function createStore() {
  return process.env.DB_PROVIDER === "supabase" ? createSupabaseStore() : createMongoStore();
}
