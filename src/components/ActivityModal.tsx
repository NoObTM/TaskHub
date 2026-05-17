import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { Clock3, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { Avatar } from "@/components/ui/Avatar";
import type { TodoActivity, TodoWithUsers } from "@/db/database";

type Props = {
  open: boolean;
  todo: TodoWithUsers | null;
  activities: TodoActivity[];
  onClose: () => void;
};

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

export function ActivityModal({ open, todo, activities, onClose }: Props) {
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#fafafa" : "#18181b";
  const emptyColor = colorScheme === "dark" ? "#52525b" : "#a1a1aa";

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[75%] rounded-t-3xl border-t border-zinc-200 bg-white pt-2 dark:border-zinc-800 dark:bg-zinc-950">
          <View className="mx-auto h-1 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <View className="flex-row items-center justify-between px-6 py-4">
            <View className="flex-1 pr-3">
              <Text className="text-xl font-bold text-zinc-950 dark:text-zinc-50">
                Histórico
              </Text>
              {todo && (
                <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400" numberOfLines={1}>
                  {todo.title}
                </Text>
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={22} color={iconColor} />
            </Pressable>
          </View>

          {activities.length === 0 ? (
            <View className="items-center px-6 py-16">
              <Clock3 size={44} color={emptyColor} />
              <Text className="mt-4 text-base text-zinc-500 dark:text-zinc-400">
                Nenhum histórico ainda
              </Text>
            </View>
          ) : (
            <FlatList
              data={activities}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
              ItemSeparatorComponent={() => <View className="h-3" />}
              renderItem={({ item }) => (
                <View className="flex-row gap-3">
                  <Avatar name={item.actorName} uri={item.actorAvatarUri} size="sm" />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                      {item.message}
                    </Text>
                    <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {item.actorName} · {formatDate(item.createdAt)}
                    </Text>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
