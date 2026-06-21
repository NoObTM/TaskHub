import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  getUserById,
  loginUser,
  registerUser,
  updateUserAvatarUri,
  type RegisterInput,
} from "@/db/auth";
import { setApiToken } from "@/db/api";
import type { User } from "@/db/schema";

const SESSION_KEY = "session.userId";
const TOKEN_KEY = "session.token";

async function secureStoreAvailable() {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function getStoredToken() {
  if (await secureStoreAvailable()) {
    const secureToken = await SecureStore.getItemAsync(TOKEN_KEY);
    if (secureToken) return secureToken;

    const legacyToken = await AsyncStorage.getItem(TOKEN_KEY);
    if (legacyToken) {
      await SecureStore.setItemAsync(TOKEN_KEY, legacyToken);
      await AsyncStorage.removeItem(TOKEN_KEY);
      return legacyToken;
    }
    return null;
  }

  return AsyncStorage.getItem(TOKEN_KEY);
}

async function setStoredToken(token: string) {
  if (await secureStoreAvailable()) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await AsyncStorage.removeItem(TOKEN_KEY);
    return;
  }

  await AsyncStorage.setItem(TOKEN_KEY, token);
}

async function removeStoredToken() {
  if (await secureStoreAvailable()) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
  await AsyncStorage.removeItem(TOKEN_KEY);
}

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  updateAvatar: (avatarUri: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(SESSION_KEY);
      const token = await getStoredToken();
      if (stored && token) {
        setApiToken(token);
        const found = await getUserById(stored);
        if (found) setUser(found);
        else {
          await AsyncStorage.removeItem(SESSION_KEY);
          await removeStoredToken();
          setApiToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginUser(email, password);
    setApiToken(result.token);
    await AsyncStorage.setItem(SESSION_KEY, result.user.id);
    await setStoredToken(result.token);
    setUser(result.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await registerUser(input);
    setApiToken(result.token);
    await AsyncStorage.setItem(SESSION_KEY, result.user.id);
    await setStoredToken(result.token);
    setUser(result.user);
  }, []);

  const updateAvatar = useCallback(
    async (avatarUri: string) => {
      if (!user) return;
      const updated = await updateUserAvatarUri(user.id, avatarUri);
      if (updated) setUser(updated);
    },
    [user]
  );

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    await removeStoredToken();
    setApiToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, updateAvatar, logout }),
    [user, loading, login, register, updateAvatar, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
