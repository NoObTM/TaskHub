import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "nativewind";

const THEME_KEY = "theme.preference";

export function useThemePersist() {
  const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme();

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") {
        setColorScheme(stored);
      }
    })();
  }, [setColorScheme]);

  const toggle = async () => {
    const next = colorScheme === "dark" ? "light" : "dark";
    await AsyncStorage.setItem(THEME_KEY, next);
    toggleColorScheme();
  };

  return { colorScheme, toggle };
}
