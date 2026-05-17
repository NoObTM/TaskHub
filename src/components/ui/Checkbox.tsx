import { Pressable, View } from "react-native";
import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  className?: string;
};

export function Checkbox({ checked, onChange, className }: Props) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      hitSlop={8}
      className={cn(
        "h-6 w-6 items-center justify-center rounded border-2",
        checked ? "border-primary bg-primary" : "border-border bg-background",
        className
      )}
    >
      {checked && <View className="h-2.5 w-2.5 rounded-sm bg-primary-foreground" />}
    </Pressable>
  );
}
