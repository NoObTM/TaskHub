import { TextInput, type TextInputProps } from "react-native";
import { useColorScheme } from "nativewind";
import { cn } from "@/lib/utils";

type Props = TextInputProps & { className?: string };

export function Input({ className, ...rest }: Props) {
  const { colorScheme } = useColorScheme();
  const placeholderColor = colorScheme === "dark" ? "#52525b" : "#a1a1aa";
  return (
    <TextInput
      placeholderTextColor={placeholderColor}
      className={cn(
        "h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
        className
      )}
      {...rest}
    />
  );
}
