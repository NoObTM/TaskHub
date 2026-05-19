import { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarDays, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { listAllUsers } from "@/db/auth";
import type { Priority, User } from "@/db/schema";
import type { TodoWithUsers } from "@/db/database";
import { cn } from "@/lib/utils";

type SubmitData = {
  assigneeId: string;
  title: string;
  priority: Priority;
  dueDate: number | null;
};

type Props = {
  open: boolean;
  currentUserId: string;
  editing?: TodoWithUsers | null;
  onClose: () => void;
  onSubmit: (data: SubmitData) => Promise<void>;
};

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: "low", label: "Baixa", color: "bg-emerald-500" },
  { value: "medium", label: "Média", color: "bg-amber-500" },
  { value: "high", label: "Alta", color: "bg-red-500" },
];

function formatDate(ts: number): string {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

export function AddTaskModal({ open, currentUserId, editing, onClose, onSubmit }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(currentUserId);
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#fafafa" : "#18181b";

  useEffect(() => {
    if (!open) return;
    listAllUsers().then(setUsers);
    if (editing) {
      setTitle(editing.title);
      setAssigneeId(editing.assigneeId);
      setPriority(editing.priority);
      setDueDate(editing.dueDate);
    } else {
      setTitle("");
      setAssigneeId(currentUserId);
      setPriority("medium");
      setDueDate(null);
    }
    setError(null);
  }, [open, currentUserId, editing]);

  useEffect(() => {
    if (!open) {
      setKeyboardHeight(0);
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [open]);

  const userOptions: SelectOption<string>[] = users.map((u) => ({
    value: u.id,
    label: u.id === currentUserId ? `${u.name} (você)` : u.name,
  }));

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Informe o título da tarefa");
      return;
    }
    if (!assigneeId) {
      setError("Selecione um responsável");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ assigneeId, title, priority, dueDate });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const onPickerChange = (_: unknown, selected?: Date) => {
    setShowPicker(Platform.OS === "ios");
    if (selected) setDueDate(selected.getTime());
  };

  const isEdit = !!editing;
  const keyboardPadding = Platform.OS === "android" ? keyboardHeight : 0;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <View className="flex-1 justify-end bg-black/50" style={{ paddingBottom: keyboardPadding }}>
          <View
            className="rounded-t-3xl border-t border-zinc-200 bg-white pt-2 dark:border-zinc-800 dark:bg-zinc-950"
            style={{ maxHeight: keyboardHeight > 0 ? "72%" : "88%" }}
          >
          <View className="mx-auto h-1 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <View className="flex-row items-center justify-between px-6 py-4">
            <Text className="text-xl font-bold text-zinc-950 dark:text-zinc-50">
              {isEdit ? "Editar tarefa" : "Nova tarefa"}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={22} color={iconColor} />
            </Pressable>
          </View>

          <ScrollView
            className="px-6"
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            <View className="gap-4">
              <View>
                <Text className="mb-1.5 text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  Título
                </Text>
                <Input
                  placeholder="O que precisa ser feito?"
                  value={title}
                  onChangeText={setTitle}
                  autoFocus={!isEdit}
                />
              </View>

              <View>
                <Text className="mb-1.5 text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  Responsável
                </Text>
                <Select<string>
                  value={assigneeId}
                  options={userOptions}
                  placeholder="Selecionar responsável"
                  onChange={setAssigneeId}
                  searchable
                  searchPlaceholder="Pesquisar usuário..."
                />
              </View>

              <View>
                <Text className="mb-1.5 text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  Prioridade
                </Text>
                <View className="flex-row gap-2">
                  {priorityOptions.map((opt) => {
                    const active = priority === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setPriority(opt.value)}
                        className={cn(
                          "flex-1 flex-row items-center justify-center gap-2 rounded-lg border px-3 py-2.5",
                          active
                            ? "border-zinc-950 bg-zinc-950 dark:border-zinc-50 dark:bg-zinc-50"
                            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                        )}
                      >
                        <View className={cn("h-2.5 w-2.5 rounded-full", opt.color)} />
                        <Text
                          className={cn(
                            "text-sm font-medium",
                            active
                              ? "text-zinc-50 dark:text-zinc-950"
                              : "text-zinc-950 dark:text-zinc-50"
                          )}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View>
                <Text className="mb-1.5 text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  Data limite (opcional)
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setShowPicker(true)}
                    className="h-11 flex-1 flex-row items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <CalendarDays size={18} color={iconColor} />
                    <Text
                      className={
                        dueDate
                          ? "flex-1 text-base text-zinc-950 dark:text-zinc-50"
                          : "flex-1 text-base text-zinc-400 dark:text-zinc-500"
                      }
                    >
                      {dueDate ? formatDate(dueDate) : "Selecionar data"}
                    </Text>
                  </Pressable>
                  {dueDate && (
                    <Pressable
                      onPress={() => setDueDate(null)}
                      hitSlop={8}
                      className="h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 active:bg-zinc-100 dark:border-zinc-800 dark:active:bg-zinc-900"
                    >
                      <X size={18} color={iconColor} />
                    </Pressable>
                  )}
                </View>
                {showPicker && (
                  <DateTimePicker
                    value={dueDate ? new Date(dueDate) : new Date()}
                    mode="date"
                    minimumDate={new Date()}
                    onChange={onPickerChange}
                  />
                )}
              </View>

              {error && <Text className="text-xs text-red-500">{error}</Text>}

              <View className="mt-2 flex-row gap-2">
                <Button
                  label="Cancelar"
                  variant="outline"
                  onPress={onClose}
                  className="flex-1"
                />
                <Button
                  label={submitting ? "Salvando..." : isEdit ? "Salvar" : "Adicionar"}
                  onPress={handleSubmit}
                  disabled={submitting}
                  className="flex-1"
                />
              </View>
            </View>
          </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
