import { Modal, Pressable, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function Dialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        onPress={onCancel}
        className="flex-1 items-center justify-center bg-black/50 px-6"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <Text className="text-lg font-bold text-zinc-950 dark:text-zinc-50">{title}</Text>
          {description ? (
            <Text className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{description}</Text>
          ) : null}
          <View className="mt-6 flex-row justify-end gap-2">
            <Button label={cancelLabel} variant="outline" size="sm" onPress={onCancel} />
            <Button
              label={confirmLabel}
              variant={destructive ? "destructive" : "default"}
              size="sm"
              onPress={onConfirm}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
