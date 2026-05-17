import "./global.css";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { AuthProvider } from "@/context/AuthContext";
import { useThemePersist } from "@/context/ThemeContext";
import { RootNavigator } from "@/navigation/RootNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemedRoot />
      </AuthProvider>
      <Toast />
    </SafeAreaProvider>
  );
}

function ThemedRoot() {
  const { colorScheme } = useThemePersist();
  return (
    <>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <RootNavigator />
    </>
  );
}
