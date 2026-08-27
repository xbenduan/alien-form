import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { getAppRuntime } from "@runtime/create-runtime";
import type { AuthUser, LoginPayload, LoginResult } from "@runtime";

const AUTH_STORAGE_KEY = "alien-mdm-auth";
const UNAUTHORIZED_EVENT = "alien-mdm:unauthorized";

interface StoredAuth {
  token: string;
  user: AuthUser;
}

interface AuthContextValue {
  token?: string;
  user?: AuthUser;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredAuth(): StoredAuth | undefined {
  try {
    const text = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!text) return undefined;
    const data = JSON.parse(text) as Partial<StoredAuth>;
    return data.token && data.user ? { token: data.token, user: data.user } : undefined;
  } catch {
    return undefined;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [auth, setAuth] = useState<StoredAuth | undefined>(() => readStoredAuth());

  useEffect(() => {
    const handleUnauthorized = () => setAuth(undefined);
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const handleLogin = useCallback(async (payload: LoginPayload) => {
    const service = getAppRuntime().registry.services.resolve("auth.login");
    if (!service) throw new Error("[alien-mdm] service auth.login 未注册");
    const result = (await service.send(payload)) as LoginResult;
    const nextAuth = { token: result.token, user: result.user };
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
    setAuth(nextAuth);
    return result.user;
  }, []);

  const handleLogout = useCallback(async () => {
    const token = auth?.token;
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuth(undefined);
    if (token) {
      const service = getAppRuntime().registry.services.resolve("auth.logout");
      if (!service) throw new Error("[alien-mdm] service auth.logout 未注册");
      await service.send({ token });
    }
  }, [auth?.token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token: auth?.token,
      user: auth?.user,
      isAuthenticated: Boolean(auth?.token && auth.user),
      login: handleLogin,
      logout: handleLogout,
    }),
    [auth, handleLogin, handleLogout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
