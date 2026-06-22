import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";
import { useColorScheme } from "nativewind";
import { cn } from "@/lib/utils";

type Variant = "default" | "destructive" | "outline" | "ghost";
type Size = "default" | "sm" | "lg" | "icon";

const variantStyles: Record<Variant, { bg: string; text: string }> = {
  default: {
    bg: "bg-zinc-900 active:opacity-80 dark:bg-zinc-50",
    text: "text-zinc-50 dark:text-zinc-900",
  },
  destructive: {
    bg: "bg-red-500 active:opacity-80",
    text: "text-white",
  },
  outline: {
    bg: "border border-zinc-200 bg-white active:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:active:bg-zinc-900",
    text: "text-zinc-950 dark:text-zinc-50",
  },
  ghost: {
    bg: "active:bg-zinc-100 dark:active:bg-zinc-900",
    text: "text-zinc-950 dark:text-zinc-50",
  },
};

const sizeStyles: Record<Size, { container: string; text: string }> = {
  default: { container: "h-11 px-4", text: "text-base" },
  sm: { container: "h-9 px-3", text: "text-sm" },
  lg: { container: "h-12 px-6", text: "text-lg" },
  icon: { container: "h-10 w-10", text: "text-base" },
};

type Props = PressableProps & {
  variant?: Variant;
  size?: Size;
  label: string;
  className?: string;
  textClassName?: string;
  loading?: boolean;
};

export function Button({
  variant = "default",
  size = "default",
  label,
  className,
  textClassName,
  loading = false,
  disabled,
  ...rest
}: Props) {
  const { colorScheme } = useColorScheme();
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const spinnerColor = variant === "default"
    ? colorScheme === "dark" ? "#18181b" : "#fafafa"
    : colorScheme === "dark" ? "#fafafa" : "#18181b";

  return (
    <Pressable
      className={cn(
        "flex-row items-center justify-center gap-2 rounded-lg",
        v.bg,
        s.container,
        (disabled || loading) && "opacity-60",
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <ActivityIndicator size="small" color={spinnerColor} />}
      <Text className={cn("font-semibold", v.text, s.text, textClassName)}>{label}</Text>
    </Pressable>
  );
}
