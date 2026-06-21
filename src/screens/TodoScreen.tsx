import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import {
  ArrowDownAZ,
  Bell,
  Camera,
  LogOut,
  Moon,
  Plus,
  Search,
  Sun,
} from "lucide-react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { TodoItem } from "@/components/TodoItem";
import { AddTaskModal } from "@/components/AddTaskModal";
import { ActivityModal } from "@/components/ActivityModal";
import { NotificationsModal } from "@/components/NotificationsModal";
import { useAuth } from "@/context/AuthContext";
import { useThemePersist } from "@/context/ThemeContext";
import {
  addTodo,
  clearCompleted,
  countUnreadAssigned,
  deleteTodo,
  listAssignedByMe,
  listTodoActivity,
  listTodos,
  listUnreadAssigned,
  markAllAsSeen,
  reorderTodos,
  toggleTodo,
  updateTodoNotificationId,
  updateTodo,
  type Priority,
  type TodoActivity,
  type TodoWithUsers,
} from "@/db/database";
import { cn } from "@/lib/utils";
import {
  cancelTodoReminder,
  registerPushToken,
  scheduleTodoReminder,
  showTaskNotification,
} from "@/lib/notifications";
import { API_URL, getApiToken } from "@/db/api";
import { io, type Socket } from "socket.io-client";

type Tab = "mine" | "assigned-by-me";
type StatusFilter = "all" | "pending" | "done";
type SortKey = "manual" | "createdAt" | "priority" | "dueDate";

const sortOptions = [
  { value: "manual" as const, label: "Ordem manual" },
  { value: "createdAt" as const, label: "Mais recentes" },
  { value: "priority" as const, label: "Prioridade" },
  { value: "dueDate" as const, label: "Data limite" },
];

const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const PAGE_SIZE = 25;

function applySort(items: TodoWithUsers[], sortBy: SortKey): TodoWithUsers[] {
  const copy = [...items];
  if (sortBy === "manual") {
    copy.sort((a, b) => b.position - a.position || b.createdAt - a.createdAt);
  } else if (sortBy === "createdAt") {
    copy.sort((a, b) => b.createdAt - a.createdAt);
  } else if (sortBy === "priority") {
    copy.sort(
      (a, b) =>
        priorityRank[a.priority] - priorityRank[b.priority] ||
        b.createdAt - a.createdAt
    );
  } else if (sortBy === "dueDate") {
    copy.sort((a, b) => {
      if (a.dueDate == null && b.dueDate == null) return b.createdAt - a.createdAt;
      if (a.dueDate == null) return 1;
      if (b.dueDate == null) return -1;
      return a.dueDate - b.dueDate;
    });
  }
  return copy;
}

function applyFilter(items: TodoWithUsers[], status: StatusFilter): TodoWithUsers[] {
  if (status === "pending") return items.filter((t) => !t.done);
  if (status === "done") return items.filter((t) => t.done);
  return items;
}

function getAvatarExtension(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.fileName?.includes(".")) {
    return asset.fileName.split(".").pop()?.toLowerCase() ?? "jpg";
  }
  if (asset.mimeType?.includes("/")) {
    return asset.mimeType.split("/").pop()?.toLowerCase() ?? "jpg";
  }
  if (asset.uri.includes(".")) {
    return asset.uri.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "jpg";
  }
  return "jpg";
}

async function copyAvatarToAppStorage(
  userId: string,
  asset: ImagePicker.ImagePickerAsset
): Promise<string> {
  if (!FileSystem.documentDirectory) return asset.uri;
  const avatarDir = `${FileSystem.documentDirectory}avatars`;
  await FileSystem.makeDirectoryAsync(avatarDir, { intermediates: true });
  const extension = getAvatarExtension(asset);
  const destination = `${avatarDir}/user-${userId}-${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: asset.uri, to: destination });
  return destination;
}

export function TodoScreen() {
  const { user, logout, updateAvatar } = useAuth();
  const userId = user!.id;
  const socketRef = useRef<Socket | null>(null);
  const knownUnreadTodoIdsRef = useRef<Set<string> | null>(null);
  const [tab, setTab] = useState<Tab>("mine");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [sortBy, setSortBy] = useState<SortKey>("manual");
  const [search, setSearch] = useState("");
  const [visiblePages, setVisiblePages] = useState(1);
  const [mineTodos, setMineTodos] = useState<TodoWithUsers[]>([]);
  const [assignedByMe, setAssignedByMe] = useState<TodoWithUsers[]>([]);
  const [notifications, setNotifications] = useState<TodoWithUsers[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TodoWithUsers | null>(null);
  const [editing, setEditing] = useState<TodoWithUsers | null>(null);
  const [activityTodo, setActivityTodo] = useState<TodoWithUsers | null>(null);
  const [activities, setActivities] = useState<TodoActivity[]>([]);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [socketStatus, setSocketStatus] = useState<"connected" | "connecting" | "offline">("connecting");
  const { colorScheme, toggle: toggleTheme } = useThemePersist();
  const isDark = colorScheme === "dark";
  const iconColor = isDark ? "#fafafa" : "#18181b";

  const refresh = useCallback(async (options: { notifyNewUnread?: boolean } = {}) => {
    try {
      const [mine, byMe, unreadRows, c] = await Promise.all([
        listTodos(userId, { search, limit: PAGE_SIZE * visiblePages, page: 1 }),
        listAssignedByMe(userId, { search, limit: PAGE_SIZE * visiblePages, page: 1 }),
        listUnreadAssigned(userId),
        countUnreadAssigned(userId),
      ]);
      const knownUnreadIds = knownUnreadTodoIdsRef.current;
      const newUnreadRows = options.notifyNewUnread
        && knownUnreadIds
        ? unreadRows.filter((todo) => !knownUnreadIds.has(todo.id))
        : [];

      setMineTodos(mine);
      setAssignedByMe(byMe);
      setNotifications(unreadRows);
      setUnreadCount(c);
      knownUnreadTodoIdsRef.current = new Set(unreadRows.map((todo) => todo.id));

      for (const todo of newUnreadRows) {
        showTaskNotification("Nova tarefa", todo.title, { todoId: todo.id }).catch(console.warn);
      }
    } catch (e: any) {
      Alert.alert("Erro DB", e?.message ?? String(e));
    }
  }, [search, userId, visiblePages]);

  useEffect(() => {
    setVisiblePages(1);
  }, [search, tab]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    registerPushToken().then((result) => {
      if (!result.ok) {
        Toast.show({
          type: "info",
          text1: "Push não registrado",
          text2: result.message,
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    const socket = io(API_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        refresh({ notifyNewUnread: true });
      }, 250);
    };

    socket.on("connect", () => {
      setSocketStatus("connected");
      socket.emit("auth", { token: getApiToken() });
      scheduleRefresh();
    });

    socket.on("disconnect", () => {
      setSocketStatus("offline");
    });

    socket.io.on("reconnect_attempt", () => {
      setSocketStatus("connecting");
    });

    socket.on("todos:changed", () => {
      scheduleRefresh();
    });

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      socketRef.current = null;
      socket.disconnect();
    };
  }, [refresh, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
      }
    });

    return () => subscription.remove();
  }, [refresh]);

  const handlePullRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const openCreate = () => {
    setEditing(null);
    setTaskModalOpen(true);
  };

  const openEdit = (todo: TodoWithUsers) => {
    if (tab !== "assigned-by-me" && todo.creatorId !== userId) {
      Toast.show({
        type: "info",
        text1: "Só o criador pode editar esta tarefa",
      });
      return;
    }
    setEditing(todo);
    setTaskModalOpen(true);
  };

  const openActivity = useCallback(async (todo: TodoWithUsers) => {
    setActivityTodo(todo);
    setActivities([]);
    try {
      setActivities(await listTodoActivity(todo.id));
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Erro ao carregar histórico",
        text2: e?.message ?? String(e),
      });
    }
  }, []);

  const handleSubmit = useCallback(
    async (data: {
      assigneeId: string;
      title: string;
      priority: Priority;
      dueDate: number | null;
    }) => {
      try {
        if (editing?.notificationId) {
          await cancelTodoReminder(editing.notificationId);
          await updateTodoNotificationId(editing.id, null);
        }

        if (editing) {
          const updated = await updateTodo({ ...data, id: editing.id, userId });
          if (updated && updated.assigneeId === userId) {
            const notificationId = await scheduleTodoReminder(updated);
            if (notificationId) {
              await updateTodoNotificationId(updated.id, notificationId);
            }
          }
          Toast.show({ type: "success", text1: "Tarefa atualizada" });
        } else {
          const created = await addTodo({ ...data, creatorId: userId });
          if (created && created.assigneeId === userId) {
            const notificationId = await scheduleTodoReminder(created);
            if (notificationId) {
              await updateTodoNotificationId(created.id, notificationId);
            }
          }
          Toast.show({ type: "success", text1: "Tarefa criada" });
        }
        await refresh();
      } catch (e: any) {
        Toast.show({
          type: "error",
          text1: "Erro",
          text2: e?.message ?? String(e),
        });
      }
    },
    [refresh, userId, editing]
  );

  const handleReorder = useCallback(
    async (data: TodoWithUsers[]) => {
      if (sortBy !== "manual") return;

      const nextPosition = Date.now();
      const positions = new Map(
        data.map((todo, index) => [todo.id, nextPosition - index])
      );
      const applyPositions = (source: TodoWithUsers[]) =>
        source.map((todo) =>
          positions.has(todo.id)
            ? { ...todo, position: positions.get(todo.id)! }
            : todo
        );

      if (tab === "mine") {
        setMineTodos(applyPositions);
      } else {
        setAssignedByMe(applyPositions);
      }

      try {
        await reorderTodos(data.map((todo) => todo.id));
      } catch (e: any) {
        Toast.show({
          type: "error",
          text1: "Erro ao salvar ordem",
          text2: e?.message ?? String(e),
        });
        await refresh();
      }
    },
    [refresh, sortBy, tab]
  );

  const handleToggle = useCallback(
    async (id: string, done: boolean) => {
      const todo = mineTodos.find((t) => t.id === id);
      if (todo?.notificationId) {
        await cancelTodoReminder(todo.notificationId);
        await updateTodoNotificationId(id, null);
      }
      await toggleTodo(userId, id, done);
      if (todo && !done) {
        const notificationId = await scheduleTodoReminder({ ...todo, done });
        if (notificationId) {
          await updateTodoNotificationId(id, notificationId);
        }
      }
      await refresh();
    },
    [mineTodos, refresh, userId]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await cancelTodoReminder(pendingDelete.notificationId);
      await deleteTodo(userId, pendingDelete.id);
      setPendingDelete(null);
      Toast.show({ type: "success", text1: "Tarefa excluída" });
      await refresh();
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Erro ao excluir",
        text2: e?.message ?? String(e),
      });
    }
  }, [pendingDelete, refresh, userId]);

  const handleClear = useCallback(async () => {
    const sourceTodos = tab === "mine" ? mineTodos : assignedByMe;
    await Promise.all(
      sourceTodos
        .filter((t) => t.done)
        .map((t) => cancelTodoReminder(t.notificationId))
    );
    await clearCompleted(userId, tab);
    Toast.show({ type: "success", text1: "Concluídas removidas" });
    await refresh();
  }, [assignedByMe, mineTodos, refresh, tab, userId]);

  const handleMarkAllSeen = useCallback(async () => {
    await markAllAsSeen(userId);
    setNotificationsOpen(false);
    await refresh();
  }, [refresh, userId]);

  const handlePickAvatar = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão necessária", "Permita acesso às fotos para trocar o avatar.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
      base64: true,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.uri) return;

    const mime = asset.mimeType ?? "image/jpeg";
    if (asset.base64) {
      await updateAvatar(`data:${mime};base64,${asset.base64}`);
    } else {
      const localUri = await copyAvatarToAppStorage(userId, asset);
      await updateAvatar(localUri);
    }
    Toast.show({ type: "success", text1: "Avatar atualizado" });
  }, [updateAvatar, userId]);

  const baseList = tab === "mine" ? mineTodos : assignedByMe;
  const list = useMemo(
    () => applySort(applyFilter(baseList, statusFilter), sortBy),
    [baseList, statusFilter, sortBy]
  );
  const remaining = mineTodos.filter((t) => !t.done).length;
  const canClearCompleted = statusFilter === "done" && list.some((t) => t.done);

  const filterChips: { value: StatusFilter; label: string }[] = [
    { value: "pending", label: `Pendentes (${baseList.filter((t) => !t.done).length})` },
    { value: "done", label: `Concluídas (${baseList.filter((t) => t.done).length})` },
    { value: "all", label: `Todas (${baseList.length})` },
  ];

  return (
    <SafeAreaView
      className="flex-1 bg-white dark:bg-zinc-950"
      edges={["top", "left", "right"]}
    >
      <View className="flex-row items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <View className="flex-1 flex-row items-center gap-3">
          <Pressable onPress={handlePickAvatar} hitSlop={8}>
            <Avatar name={user!.name} uri={user!.avatarUri} size="lg" />
            <View className="absolute -bottom-1 -right-1 h-5 w-5 items-center justify-center rounded-full border border-white bg-zinc-900 dark:border-zinc-950 dark:bg-zinc-50">
              <Camera size={11} color={isDark ? "#18181b" : "#fafafa"} />
            </View>
          </Pressable>
          <View className="flex-1">
            <Text className="text-xl font-bold text-zinc-950 dark:text-zinc-50" numberOfLines={1}>
              Olá, {user!.name}
            </Text>
            <Text className="text-sm text-zinc-500 dark:text-zinc-400">
              {loading ? "Carregando..." : `${remaining} pendente${remaining === 1 ? "" : "s"}`}
            </Text>
            {socketStatus !== "connected" && (
              <Text className="text-xs text-amber-600 dark:text-amber-400">
                {socketStatus === "connecting" ? "Reconectando..." : "Offline"}
              </Text>
            )}
          </View>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={toggleTheme}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 active:bg-zinc-100 dark:border-zinc-800 dark:active:bg-zinc-900"
          >
            {isDark ? <Sun size={20} color={iconColor} /> : <Moon size={20} color={iconColor} />}
          </Pressable>
          <Pressable
            onPress={() => setNotificationsOpen(true)}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 active:bg-zinc-100 dark:border-zinc-800 dark:active:bg-zinc-900"
          >
            <Bell size={20} color={iconColor} />
            {unreadCount > 0 && (
              <View className="absolute -right-1 -top-1 min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1">
                <Text className="text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={logout}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 active:bg-zinc-100 dark:border-zinc-800 dark:active:bg-zinc-900"
          >
            <LogOut size={20} color={iconColor} />
          </Pressable>
        </View>
      </View>

      <View className="px-5 pt-3">
        <View className="flex-row rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
          <Pressable
            onPress={() => setTab("mine")}
            className={cn(
              "flex-1 items-center rounded-md py-2",
              tab === "mine" && "bg-white dark:bg-zinc-950"
            )}
          >
            <Text
              className={cn(
                "text-sm font-medium",
                tab === "mine"
                  ? "text-zinc-950 dark:text-zinc-50"
                  : "text-zinc-500 dark:text-zinc-400"
              )}
            >
              Para mim ({mineTodos.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("assigned-by-me")}
            className={cn(
              "flex-1 items-center rounded-md py-2",
              tab === "assigned-by-me" && "bg-white dark:bg-zinc-950"
            )}
          >
            <Text
              className={cn(
                "text-sm font-medium",
                tab === "assigned-by-me"
                  ? "text-zinc-950 dark:text-zinc-50"
                  : "text-zinc-500 dark:text-zinc-400"
              )}
            >
              Designei ({assignedByMe.length})
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="px-5 pt-3">
        <View className="h-11 flex-row items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950">
          <Search size={18} color={iconColor} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar tarefa"
            placeholderTextColor={isDark ? "#71717a" : "#a1a1aa"}
            className="flex-1 text-base text-zinc-950 dark:text-zinc-50"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View className="flex-row flex-wrap items-center gap-2 px-5 pt-3">
        {filterChips.map((chip) => {
          const active = statusFilter === chip.value;
          return (
            <Pressable
              key={chip.value}
              onPress={() => setStatusFilter(chip.value)}
              className={cn(
                "rounded-full border px-3 py-1.5",
                active
                  ? "border-zinc-950 bg-zinc-950 dark:border-zinc-50 dark:bg-zinc-50"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              )}
            >
              <Text
                className={cn(
                  "text-xs font-medium",
                  active
                    ? "text-zinc-50 dark:text-zinc-950"
                    : "text-zinc-700 dark:text-zinc-300"
                )}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row items-center gap-2 px-5 py-3">
        <View className="flex-1">
          <Select<SortKey>
            value={sortBy}
            options={sortOptions}
            onChange={setSortBy}
          />
        </View>
        <View className="h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800">
          <ArrowDownAZ size={18} color={iconColor} />
        </View>
      </View>

      <View className="px-5 pb-3">
        <Pressable
          onPress={openCreate}
          className="h-12 flex-row items-center justify-center gap-2 rounded-lg bg-zinc-900 active:opacity-80 dark:bg-zinc-50"
        >
          <Plus size={20} color={isDark ? "#18181b" : "#fafafa"} />
          <Text className="text-base font-semibold text-zinc-50 dark:text-zinc-900">
            Nova tarefa
          </Text>
        </Pressable>
      </View>

      <DraggableFlatList
        data={list}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handlePullRefresh}
            tintColor={iconColor}
          />
        }
        renderItem={({ item, drag, isActive }: RenderItemParams<TodoWithUsers>) => (
          <ScaleDecorator activeScale={1.02}>
            <View className={isActive ? "opacity-90" : undefined}>
              <TodoItem
                todo={item}
                currentUserId={userId}
                mode={tab}
                onToggle={handleToggle}
                onEdit={openEdit}
                onDelete={setPendingDelete}
                onHistory={openActivity}
                onLongPress={sortBy === "manual" ? () => drag() : undefined}
              />
            </View>
          </ScaleDecorator>
        )}
        onDragEnd={({ data }) => handleReorder(data)}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (list.length >= visiblePages * PAGE_SIZE) {
            setVisiblePages((page) => page + 1);
          }
        }}
        ListEmptyComponent={
          !loading ? (
            <View className="mt-16 items-center px-6">
              <Text className="text-center text-base text-zinc-500 dark:text-zinc-400">
                Nenhuma tarefa nesta visualização.
              </Text>
            </View>
          ) : null
        }
      />

      {canClearCompleted && (
        <View className="border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <Button
            label="Limpar concluídas"
            variant="outline"
            size="default"
            onPress={handleClear}
          />
        </View>
      )}

      <AddTaskModal
        open={taskModalOpen}
        currentUserId={userId}
        editing={editing}
        onClose={() => {
          setTaskModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      <NotificationsModal
        open={notificationsOpen}
        notifications={notifications}
        onClose={() => setNotificationsOpen(false)}
        onMarkAllAsSeen={handleMarkAllSeen}
      />

      <ActivityModal
        open={activityTodo !== null}
        todo={activityTodo}
        activities={activities}
        onClose={() => {
          setActivityTodo(null);
          setActivities([]);
        }}
      />

      <Dialog
        open={pendingDelete !== null}
        title="Excluir tarefa?"
        description={pendingDelete?.title}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </SafeAreaView>
  );
}
