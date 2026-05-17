import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { Check, ChevronDown, Search } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { Input } from "@/components/ui/Input";

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
};

type Props<T extends string | number> = {
  value: T | null;
  options: SelectOption<T>[];
  placeholder?: string;
  onChange: (value: T) => void;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
};

export function Select<T extends string | number>({
  value,
  options,
  placeholder = "Selecionar",
  onChange,
  disabled,
  searchable = false,
  searchPlaceholder = "Pesquisar...",
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#a1a1aa" : "#71717a";
  const checkColor = colorScheme === "dark" ? "#fafafa" : "#18181b";
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        className="h-11 flex-row items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <Text
          className={
            selected
              ? "flex-1 text-base text-zinc-950 dark:text-zinc-50"
              : "flex-1 text-base text-zinc-400 dark:text-zinc-500"
          }
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={18} color={iconColor} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable
          onPress={close}
          className="flex-1 items-center justify-center bg-black/50 px-6"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="max-h-[70%] w-full max-w-md rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
          >
            {searchable && (
              <View className="border-b border-zinc-200 px-3 py-3 dark:border-zinc-800">
                <View className="relative">
                  <View className="absolute left-3 top-0 h-11 justify-center">
                    <Search size={16} color={iconColor} />
                  </View>
                  <Input
                    value={query}
                    onChangeText={setQuery}
                    placeholder={searchPlaceholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="pl-9"
                  />
                </View>
              </View>
            )}
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.value)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View className="px-4 py-8 items-center">
                  <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                    Nenhum resultado
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isActive = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      close();
                    }}
                    className="flex-row items-center justify-between border-b border-zinc-100 px-4 py-3 active:bg-zinc-100 dark:border-zinc-900 dark:active:bg-zinc-900"
                  >
                    <Text className="flex-1 text-base text-zinc-950 dark:text-zinc-50">
                      {item.label}
                    </Text>
                    {isActive && <Check size={18} color={checkColor} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
