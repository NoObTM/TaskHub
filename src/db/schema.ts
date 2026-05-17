export type Priority = "low" | "medium" | "high";

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUri: string | null;
  createdAt: number;
};

export type Todo = {
  id: string;
  creatorId: string;
  assigneeId: string;
  title: string;
  done: boolean;
  priority: Priority;
  dueDate: number | null;
  notificationId: string | null;
  seen: boolean;
  createdAt: number;
};

export type NewUser = Omit<User, "id" | "createdAt">;
export type NewTodo = Omit<Todo, "id" | "createdAt">;
