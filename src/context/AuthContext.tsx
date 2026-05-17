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
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (stored && token) {
        setApiToken(token);
        const found = await getUserById(stored);
        if (found) setUser(found);
        else {
          await AsyncStorage.multiRemove([SESSION_KEY, TOKEN_KEY]);
          setApiToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginUser(email, password);
    setApiToken(result.token);
    await AsyncStorage.multiSet([
      [SESSION_KEY, result.user.id],
      [TOKEN_KEY, result.token],
    ]);
    setUser(result.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await registerUser(input);
    setApiToken(result.token);
    await AsyncStorage.multiSet([
      [SESSION_KEY, result.user.id],
      [TOKEN_KEY, result.token],
    ]);
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
    await AsyncStorage.multiRemove([SESSION_KEY, TOKEN_KEY]);
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
