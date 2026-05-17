import { apiFetch } from "./api";
import type { Priority, Todo } from "./schema";

export type { Priority, Todo };

export type TodoWithUsers = Todo & {
  creatorName: string;
  creatorAvatarUri: string | null;
  assigneeName: string;
  assigneeAvatarUri: string | null;
};

export type TodoActivity = {
  id: string;
  todoId: string;
  actorId: string;
  actorName: string;
  actorAvatarUri: string | null;
  type: "created" | "updated" | "completed" | "reopened" | "deleted";
  message: string;
  createdAt: number;
};

type ListOptions = {
  search?: string;
  limit?: number;
  page?: number;
};

function toQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query.toString();
}

export function listTodos(
  userId: string,
  options: ListOptions = {}
): Promise<TodoWithUsers[]> {
  const query = toQuery({ assigneeId: userId, ...options });
  return apiFetch<TodoWithUsers[]>(`/todos?${query}`);
}

export function listAssignedByMe(
  userId: string,
  options: ListOptions = {}
): Promise<TodoWithUsers[]> {
  const query = toQuery({ creatorId: userId, excludeSelf: 1, ...options });
  return apiFetch<TodoWithUsers[]>(`/todos?${query}`);
}

export function listUnreadAssigned(userId: string): Promise<TodoWithUsers[]> {
  return apiFetch<TodoWithUsers[]>(`/todos/unread?assigneeId=${userId}`);
}

export async function countUnreadAssigned(userId: string): Promise<number> {
  const result = await apiFetch<{ count: number }>(
    `/todos/unread/count?assigneeId=${userId}`
  );
  return result.count;
}

export type AddTodoInput = {
  creatorId: string;
  assigneeId: string;
  title: string;
  priority: Priority;
  dueDate: number | null;
};

export function addTodo(input: AddTodoInput): Promise<Todo | null> {
  return apiFetch<Todo | null>("/todos", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type UpdateTodoInput = {
  id: string;
  userId: string;
  title: string;
  assigneeId: string;
  priority: Priority;
  dueDate: number | null;
};

export function updateTodo(input: UpdateTodoInput): Promise<Todo | null> {
  return apiFetch<Todo | null>(`/todos/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function updateTodoNotificationId(
  id: string,
  notificationId: string | null
): Promise<void> {
  return apiFetch<void>(`/todos/${id}/notification`, {
    method: "PATCH",
    body: JSON.stringify({ notificationId }),
  });
}

export function toggleTodo(
  userId: string,
  id: string,
  done: boolean
): Promise<void> {
  return apiFetch<void>(`/todos/${id}/toggle`, {
    method: "PATCH",
    body: JSON.stringify({ userId, done }),
  });
}

export function deleteTodo(userId: string, id: string): Promise<void> {
  return apiFetch<void>(`/todos/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ userId }),
  });
}

export function clearCompleted(
  userId: string,
  scope: "mine" | "assigned-by-me"
): Promise<{ deletedCount: number }> {
  const query = toQuery({ assigneeId: userId, scope });
  return apiFetch<{ deletedCount: number }>(`/todos/completed?${query}`, {
    method: "DELETE",
  });
}

export function markAllAsSeen(userId: string): Promise<void> {
  return apiFetch<void>(`/todos/seen`, {
    method: "PATCH",
    body: JSON.stringify({ userId }),
  });
}

export function listTodoActivity(todoId: string): Promise<TodoActivity[]> {
  return apiFetch<TodoActivity[]>(`/todos/${todoId}/activity`);
}
