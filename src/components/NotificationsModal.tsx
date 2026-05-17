import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { Bell, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import type { TodoWithUsers } from "@/db/database";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const priorityLabel: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const priorityColor: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

type Props = {
  open: boolean;
  notifications: TodoWithUsers[];
  onClose: () => void;
  onMarkAllAsSeen: () => void;
};

export function NotificationsModal({ open, notifications, onClose, onMarkAllAsSeen }: Props) {
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#fafafa" : "#18181b";
  const emptyColor = colorScheme === "dark" ? "#52525b" : "#a1a1aa";

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[80%] rounded-t-3xl border-t border-zinc-200 bg-white pt-2 dark:border-zinc-800 dark:bg-zinc-950">
          <View className="mx-auto h-1 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <View className="flex-row items-center justify-between px-6 py-4">
            <Text className="text-xl font-bold text-zinc-950 dark:text-zinc-50">
              Notificações
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={22} color={iconColor} />
            </Pressable>
          </View>

          {notifications.length === 0 ? (
            <View className="items-center px-6 py-16">
              <Bell size={48} color={emptyColor} />
              <Text className="mt-4 text-base text-zinc-500 dark:text-zinc-400">
                Nenhuma notificação
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                data={notifications}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16 }}
                ItemSeparatorComponent={() => <View className="h-2" />}
                renderItem={({ item }) => (
                  <View className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <View className="flex-row items-start gap-2">
                      <View
                        className={cn("mt-1.5 h-2.5 w-2.5 rounded-full", priorityColor[item.priority])}
                      />
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                          {item.title}
                        </Text>
                        <Text className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          De {item.creatorName} · Prioridade {priorityLabel[item.priority]}
                          {item.dueDate ? ` · até ${formatDate(item.dueDate)}` : ""}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              />
              <View className="border-t border-zinc-200 px-6 py-3 dark:border-zinc-800">
                <Button
                  label="Marcar todas como lidas"
                  variant="outline"
                  size="sm"
                  onPress={onMarkAllAsSeen}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
