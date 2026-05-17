import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Moon, Sun } from "lucide-react-native";
import { useThemePersist } from "@/context/ThemeContext";
import { AlertModal } from "@/components/ui/AlertModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { loginSchema, type LoginInput } from "@/lib/schemas";

type Props = {
  onNavigateSignup: () => void;
};

export function LoginScreen({ onNavigateSignup }: Props) {
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { colorScheme, toggle: toggleColorScheme } = useThemePersist();
  const isDark = colorScheme === "dark";
  const iconColor = isDark ? "#fafafa" : "#18181b";

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginInput) => {
    setSubmitting(true);
    try {
      await login(data.email, data.password);
    } catch (e: any) {
      setErrorMessage(e.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950" edges={["top", "left", "right"]}>
      <View className="flex-row justify-end px-5 py-3">
        <Pressable
          onPress={toggleColorScheme}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 active:bg-zinc-100 dark:border-zinc-800 dark:active:bg-zinc-900"
        >
          {isDark ? <Sun size={20} color={iconColor} /> : <Moon size={20} color={iconColor} />}
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 16 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={80}
        enableResetScrollToCoords={false}
      >
        <Text className="text-3xl font-bold text-zinc-950 dark:text-zinc-50">Bem-vindo</Text>
        <Text className="mt-2 text-base text-zinc-500 dark:text-zinc-400">
          Entre na sua conta para continuar
        </Text>

        <View className="mt-8 gap-4">
          <View>
            <Text className="mb-1.5 text-sm font-medium text-zinc-950 dark:text-zinc-50">
              E-mail
            </Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="seu@email.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
            {errors.email && (
              <Text className="mt-1 text-xs text-red-500">{errors.email.message}</Text>
            )}
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-medium text-zinc-950 dark:text-zinc-50">
              Senha
            </Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="••••••"
                  secureTextEntry
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
            {errors.password && (
              <Text className="mt-1 text-xs text-red-500">{errors.password.message}</Text>
            )}
          </View>

          <Button
            label={submitting ? "Entrando..." : "Entrar"}
            onPress={handleSubmit(onSubmit)}
            disabled={submitting}
          />
        </View>

        <View className="mt-6 flex-row justify-center">
          <Text className="text-sm text-zinc-500 dark:text-zinc-400">Não tem conta? </Text>
          <Pressable onPress={onNavigateSignup} hitSlop={4}>
            <Text className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Cadastre-se
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>

      <AlertModal
        open={errorMessage !== null}
        variant="error"
        title="Erro ao entrar"
        description={errorMessage ?? undefined}
        onClose={() => setErrorMessage(null)}
      />
    </SafeAreaView>
  );
}
