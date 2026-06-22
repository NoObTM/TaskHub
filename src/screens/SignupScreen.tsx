import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { AlertModal } from "@/components/ui/AlertModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { signupSchema, type SignupInput } from "@/lib/schemas";
import { EmailInUseError, PhoneInUseError } from "@/db/auth";
import { formatBrazilianPhone } from "@/lib/phone";

type Props = {
  onNavigateLogin: () => void;
};

export function SignupScreen({ onNavigateLogin }: Props) {
  const { register } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#fafafa" : "#18181b";

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", phone: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: SignupInput) => {
    setSubmitting(true);
    try {
      await register({ name: data.name, email: data.email, phone: data.phone, password: data.password });
    } catch (e: any) {
      if (e instanceof EmailInUseError) {
        setError("email", { message: e.message });
      } else if (e instanceof PhoneInUseError) {
        setError("phone", { message: e.message });
      } else {
        setErrorMessage(e.message ?? String(e));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950" edges={["top", "left", "right"]}>
      <View className="flex-row items-center px-5 py-3">
        <Pressable onPress={onNavigateLogin} hitSlop={8} className="p-2">
          <ArrowLeft size={22} color={iconColor} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 16 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={80}
        enableResetScrollToCoords={false}
      >
          <Text className="text-3xl font-bold text-zinc-950 dark:text-zinc-50">Criar conta</Text>
          <Text className="mt-2 text-base text-zinc-500 dark:text-zinc-400">
            Preencha os dados para começar
          </Text>

          <View className="mt-8 gap-4">
            <View>
              <Text className="mb-1.5 text-sm font-medium text-zinc-950 dark:text-zinc-50">
                Nome
              </Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    placeholder="Seu nome"
                    autoCapitalize="words"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
              {errors.name && (
                <Text className="mt-1 text-xs text-red-500">{errors.name.message}</Text>
              )}
            </View>

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
                Telefone
              </Text>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    placeholder="(11) 99999-9999"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="phone-pad"
                    maxLength={14}
                    value={value}
                    onChangeText={(next) => onChange(formatBrazilianPhone(next))}
                    onBlur={onBlur}
                  />
                )}
              />
              {errors.phone && (
                <Text className="mt-1 text-xs text-red-500">{errors.phone.message}</Text>
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
                    placeholder="Mínimo 6 caracteres"
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

            <View>
              <Text className="mb-1.5 text-sm font-medium text-zinc-950 dark:text-zinc-50">
                Confirmar senha
              </Text>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    placeholder="Repita a senha"
                    secureTextEntry
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
              {errors.confirmPassword && (
                <Text className="mt-1 text-xs text-red-500">
                  {errors.confirmPassword.message}
                </Text>
              )}
            </View>

            <Button
              label={submitting ? "Criando..." : "Criar conta"}
              onPress={handleSubmit(onSubmit)}
              disabled={submitting}
            />
          </View>
      </KeyboardAwareScrollView>

      <AlertModal
        open={errorMessage !== null}
        variant="error"
        title="Erro ao cadastrar"
        description={errorMessage ?? undefined}
        onClose={() => setErrorMessage(null)}
      />
    </SafeAreaView>
  );
}
