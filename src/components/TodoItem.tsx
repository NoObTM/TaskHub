import { Pressable, Text, View } from "react-native";
import { CalendarDays, CheckCircle2, Circle, History, Trash2 } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import type { TodoWithUsers } from "@/db/database";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

type Props = {
  todo: TodoWithUsers;
  currentUserId: string;
  mode: "mine" | "assigned-by-me";
  onToggle: (id: string, done: boolean) => void;
  onDelete: (todo: TodoWithUsers) => void;
  onHistory: (todo: TodoWithUsers) => void;
  onLongPress?: (todo: TodoWithUsers) => void;
};

const priorityLabel: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const priorityClass: Record<string, string> = {
  low: "bg-emerald-100 dark:bg-emerald-950",
  medium: "bg-amber-100 dark:bg-amber-950",
  high: "bg-red-100 dark:bg-red-950",
};

const priorityTextClass: Record<string, string> = {
  low: "text-emerald-700 dark:text-emerald-400",
  medium: "text-amber-700 dark:text-amber-400",
  high: "text-red-700 dark:text-red-400",
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatShortDate(ts: number): string {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function isOverdue(ts: number): boolean {
  return ts < Date.now() - 24 * 60 * 60 * 1000;
}

export function TodoItem({
  todo,
  currentUserId,
  mode,
  onToggle,
  onDelete,
  onHistory,
  onLongPress,
}: Props) {
  const { colorScheme } = useColorScheme();
  const done = todo.done;
  const circleColor = colorScheme === "dark" ? "#52525b" : "#a1a1aa";
  const checkFill = colorScheme === "dark" ? "#052e16" : "#dcfce7";
  const metaIconColor = colorScheme === "dark" ? "#a1a1aa" : "#71717a";
  const isFromOther = todo.creatorId !== currentUserId;
  const overdue = todo.dueDate != null && !done && isOverdue(todo.dueDate);
  const canToggle = mode === "mine";
  const canDelete = mode === "assigned-by-me" || todo.creatorId === currentUserId;

  const showPerson =
    mode === "assigned-by-me" || (mode === "mine" && isFromOther);
  const personName =
    mode === "assigned-by-me" ? todo.assigneeName : todo.creatorName;
  const personAvatarUri =
    mode === "assigned-by-me" ? todo.assigneeAvatarUri : todo.creatorAvatarUri;
  const personPrefix = mode === "assigned-by-me" ? "Para" : "De";

  return (
    <Pressable
      onLongPress={() => onLongPress?.(todo)}
      delayLongPress={400}
      className="rounded-xl border border-zinc-200 bg-white px-4 py-3 active:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:active:bg-zinc-900"
    >
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => {
            if (canToggle) onToggle(todo.id, !done);
          }}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center"
        >
          {done ? (
            <CheckCircle2 size={26} color="#22c55e" fill={checkFill} />
          ) : (
            <Circle size={26} color={circleColor} />
          )}
        </Pressable>
        <View className="flex-1">
          <Text
            className={cn(
              "text-base text-zinc-950 dark:text-zinc-50",
              done && "text-zinc-500 line-through dark:text-zinc-400"
            )}
          >
            {todo.title}
          </Text>

          <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
            <View className={cn("rounded-full px-2 py-0.5", priorityClass[todo.priority])}>
              <Text className={cn("text-xs font-medium", priorityTextClass[todo.priority])}>
                {priorityLabel[todo.priority]}
              </Text>
            </View>
            {showPerson && (
              <View className="flex-row items-center gap-1.5">
                <Avatar name={personName} uri={personAvatarUri} size="xs" />
                <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                  {personPrefix} {personName}
                </Text>
              </View>
            )}
            {todo.dueDate && (
              <View className="flex-row items-center gap-1">
                <CalendarDays size={12} color={overdue ? "#ef4444" : metaIconColor} />
                <Text
                  className={cn(
                    "text-xs",
                    overdue ? "font-medium text-red-500" : "text-zinc-500 dark:text-zinc-400"
                  )}
                >
                  {formatDate(todo.dueDate)}
                </Text>
              </View>
            )}
            {done && todo.completedAt && (
              <View className="flex-row items-center gap-1">
                <CheckCircle2 size={12} color="#22c55e" />
                <Text className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Finalizada em {formatShortDate(todo.completedAt)}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View className="flex-row items-center">
          <Pressable
            onPress={() => onHistory(todo)}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center"
          >
            <History size={21} color={metaIconColor} />
          </Pressable>
          {canDelete ? (
            <Pressable
              onPress={() => onDelete(todo)}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center"
            >
              <Trash2 size={22} color="#ef4444" />
            </Pressable>
          ) : (
            <View className="h-9 w-9" />
          )}
        </View>
      </View>
    </Pressable>
  );
}
