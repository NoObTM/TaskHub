import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import Toast from "react-native-toast-message";
import { AlertModal } from "@/components/ui/AlertModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestPasswordReset, resetPassword } from "@/db/auth";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/schemas";

type Props = {
  onNavigateLogin: () => void;
};

export function ResetPasswordScreen({ onNavigateLogin }: Props) {
  const [requestingCode, setRequestingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [codeRequested, setCodeRequested] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#fafafa" : "#18181b";

  const {
    control,
    getValues,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "", resetCode: "", password: "", confirmPassword: "" },
  });

  const handleRequestCode = async () => {
    const validEmail = await trigger("email");
    if (!validEmail) return;

    setRequestingCode(true);
    try {
      await requestPasswordReset(getValues("email"));
      setCodeRequested(true);
      Toast.show({
        type: "success",
        text1: "Código solicitado",
        text2: "Informe o código recebido para criar uma nova senha.",
      });
    } catch (e: any) {
      setErrorMessage(e.message ?? String(e));
    } finally {
      setRequestingCode(false);
    }
  };

  const onSubmit = async (data: ResetPasswordInput) => {
    setSubmitting(true);
    try {
      await resetPassword(data.email, data.resetCode, data.password);
      Toast.show({
        type: "success",
        text1: "Senha atualizada",
        text2: "Entre novamente com sua nova senha.",
      });
      onNavigateLogin();
    } catch (e: any) {
      setErrorMessage(e.message ?? String(e));
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
        <Text className="text-3xl font-bold text-zinc-950 dark:text-zinc-50">Redefinir senha</Text>
        <Text className="mt-2 text-base text-zinc-500 dark:text-zinc-400">
          Solicite um código temporário e escolha uma nova senha
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

          <Button
            label={requestingCode ? "Solicitando..." : codeRequested ? "Solicitar novo código" : "Solicitar código"}
            variant="outline"
            onPress={handleRequestCode}
            disabled={requestingCode || submitting}
          />

          {codeRequested && (
            <Text className="text-xs text-zinc-500 dark:text-zinc-400">
              Em ambiente local, confira o código no terminal da API. Em produção, conecte um provedor de e-mail para entregar esse código ao usuário.
            </Text>
          )}

          <View>
            <Text className="mb-1.5 text-sm font-medium text-zinc-950 dark:text-zinc-50">
              Código de segurança
            </Text>
            <Controller
              control={control}
              name="resetCode"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={value}
                  onChangeText={(next) => onChange(next.replace(/\D/g, ""))}
                  onBlur={onBlur}
                />
              )}
            />
            {errors.resetCode && (
              <Text className="mt-1 text-xs text-red-500">{errors.resetCode.message}</Text>
            )}
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-medium text-zinc-950 dark:text-zinc-50">
              Nova senha
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
              Confirmar nova senha
            </Text>
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="Repita a nova senha"
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
            label={submitting ? "Salvando..." : "Salvar nova senha"}
            onPress={handleSubmit(onSubmit)}
            disabled={submitting || requestingCode}
          />
        </View>
      </KeyboardAwareScrollView>

      <AlertModal
        open={errorMessage !== null}
        variant="error"
        title="Erro ao redefinir"
        description={errorMessage ?? undefined}
        onClose={() => setErrorMessage(null)}
      />
    </SafeAreaView>
  );
}