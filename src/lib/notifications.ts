import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import type { Todo } from "@/db/schema";
import { apiFetch } from "@/db/api";

const TODO_REMINDER_CHANNEL_ID = "todo-reminders";

export type PushRegistrationResult =
  | { ok: true; pushToken: string }
  | { ok: false; message: string };

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

async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(TODO_REMINDER_CHANNEL_ID, {
    name: "Tarefas",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function ensureNotificationReady(): Promise<boolean> {
  await ensureAndroidNotificationChannel();

  const existing = await Notifications.getPermissionsAsync();
  const finalStatus =
    existing.status === "granted"
      ? existing.status
      : (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== "granted") return false;

  return true;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
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
      sound: "default",
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: TODO_REMINDER_CHANNEL_ID,
    },
  });
}

export async function showTaskNotification(
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  const ready = await ensureNotificationReady();
  if (!ready) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger:
        Platform.OS === "android"
          ? { channelId: TODO_REMINDER_CHANNEL_ID }
          : null,
    });
  } catch (error) {
    console.warn("Local notification failed", error);
  }
}

export async function registerPushToken(): Promise<PushRegistrationResult> {
  try {
    const ready = await ensureNotificationReady();
    if (!ready) {
      return { ok: false, message: "Permissão de notificação não concedida." };
    }

    const projectId = getProjectId();
    if (!projectId) {
      return { ok: false, message: "Project ID do EAS não encontrado." };
    }

    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    await apiFetch<void>("/users/me/push-token", {
      method: "POST",
      body: JSON.stringify({ pushToken: result.data }),
    });

    return { ok: true, pushToken: result.data };
  } catch (error) {
    return {
      ok: false,
      message: `Falha ao registrar push: ${getErrorMessage(error)}`,
    };
  }
}
