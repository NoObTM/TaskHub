import { Image, Text, View } from "react-native";
import { cn } from "@/lib/utils";

const palette = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
];

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function getColor(name: string): string {
  const hash = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

type Props = {
  name: string;
  uri?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  xs: { box: "h-5 w-5", text: "text-[10px]" },
  sm: { box: "h-7 w-7", text: "text-xs" },
  md: { box: "h-10 w-10", text: "text-sm" },
  lg: { box: "h-14 w-14", text: "text-lg" },
};

export function Avatar({ name, uri, size = "md", className }: Props) {
  const s = sizeMap[size];
  if (uri) {
    return (
      <Image
        source={{ uri }}
        className={cn("rounded-full", s.box, className)}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      className={cn(
        "items-center justify-center rounded-full",
        getColor(name),
        s.box,
        className
      )}
    >
      <Text className={cn("font-bold text-white", s.text)}>{getInitials(name)}</Text>
    </View>
  );
}
