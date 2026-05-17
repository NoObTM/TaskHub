import "dotenv/config";
import mongoose from "mongoose";

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

todoSchema.index({ assigneeId: 1, createdAt: -1 });
todoSchema.index({ creatorId: 1, assigneeId: 1, createdAt: -1 });
todoSchema.index({ assigneeId: 1, creatorId: 1, seen: 1, createdAt: -1 });
todoSchema.index({ assigneeId: 1, done: 1 });
activitySchema.index({ todoId: 1, createdAt: -1 });

const User = mongoose.model("User", userSchema);
const Todo = mongoose.model("Todo", todoSchema);
const Activity = mongoose.model("Activity", activitySchema);

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI ausente. Crie server/.env.");
}

await mongoose.connect(process.env.MONGODB_URI);
await User.createCollection();
await Todo.createCollection();
await Activity.createCollection();
await User.syncIndexes();
await Todo.syncIndexes();
await Activity.syncIndexes();

console.log("MongoDB collections e indexes OK");
await mongoose.disconnect();
