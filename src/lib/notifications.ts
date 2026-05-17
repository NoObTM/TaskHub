import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import type { Todo } from "@/db/schema";
import { apiFetch } from "@/db/api";

const TODO_REMINDER_CHANNEL_ID = "todo-reminders";

function getProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureNotificationReady(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  const finalStatus =
    existing.status === "granted"
      ? existing.status
      : (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== "granted") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(TODO_REMINDER_CHANNEL_ID, {
      name: "Lembretes de tarefas",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  }

  return true;
}

function getReminderDate(dueDate: number): Date | null {
  const date = new Date(dueDate);
  date.setHours(9, 0, 0, 0);
  if (date.getTime() <= Date.now()) return null;
  return date;
}

export async function cancelTodoReminder(
  notificationId?: string | null
): Promise<void> {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function scheduleTodoReminder(todo: Todo): Promise<string | null> {
  if (!todo.dueDate || todo.done) return null;

  const date = getReminderDate(todo.dueDate);
  if (!date) return null;

  const ready = await ensureNotificationReady();
  if (!ready) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Tarefa para hoje",
      body: todo.title,
      data: { todoId: todo.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: TODO_REMINDER_CHANNEL_ID,
    },
  });
}

export async function registerPushToken(): Promise<void> {
  const ready = await ensureNotificationReady();
  if (!ready) return;

  try {
    const projectId = getProjectId();
    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    await apiFetch<void>("/users/me/push-token", {
      method: "POST",
      body: JSON.stringify({ pushToken: result.data }),
    });
  } catch (error) {
    if (__DEV__) console.warn("Push registration failed", error);
    // Push is best-effort: local reminders still work in Expo Go/dev environments.
  }
}
