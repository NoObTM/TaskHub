import { Modal, Pressable, Text, View } from "react-native";
import { AlertCircle, CheckCircle2, XCircle, type LucideIcon } from "lucide-react-native";
import { Button } from "@/components/ui/Button";

type Variant = "error" | "success" | "info";

const variants: Record<Variant, { icon: LucideIcon; color: string }> = {
  error: { icon: XCircle, color: "#ef4444" },
  success: { icon: CheckCircle2, color: "#22c55e" },
  info: { icon: AlertCircle, color: "#3b82f6" },
};

type Props = {
  open: boolean;
  variant?: Variant;
  title: string;
  description?: string;
  buttonLabel?: string;
  onClose: () => void;
};

export function AlertModal({
  open,
  variant = "info",
  title,
  description,
  buttonLabel = "OK",
  onClose,
}: Props) {
  const { icon: Icon, color } = variants[variant];
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        className="flex-1 items-center justify-center bg-black/50 px-6"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-md items-center rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <Icon size={64} color={color} />
          <Text className="mt-4 text-center text-xl font-bold text-zinc-950 dark:text-zinc-50">
            {title}
          </Text>
          {description ? (
            <Text className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {description}
            </Text>
          ) : null}
          <View className="mt-6 w-full">
            <Button label={buttonLabel} onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
