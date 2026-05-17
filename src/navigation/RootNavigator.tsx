import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { LoginScreen } from "@/screens/LoginScreen";
import { SignupScreen } from "@/screens/SignupScreen";
import { TodoScreen } from "@/screens/TodoScreen";

function AuthFlow() {
  const [screen, setScreen] = useState<"login" | "signup">("login");
  if (screen === "login") {
    return <LoginScreen onNavigateSignup={() => setScreen("signup")} />;
  }
  return <SignupScreen onNavigateLogin={() => setScreen("login")} />;
}

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-zinc-950">
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) return <AuthFlow />;
  return <TodoScreen />;
}
