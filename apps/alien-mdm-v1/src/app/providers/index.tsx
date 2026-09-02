import { App as AntdApp, ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { LoginResponse } from "@app-types";
import { transport } from "@runtime/transport";

const USER_STORAGE_KEY = "alien-mdm-user";

interface AuthValue {
  authenticated: boolean;
  user?: Record<string, unknown>;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function storedUser(): Record<string, unknown> | undefined {
  try {
    const value = localStorage.getItem(USER_STORAGE_KEY);
    return value ? (JSON.parse(value) as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function AuthProvider({ children }: PropsWithChildren) {
  const [authenticated, setAuthenticated] = useState(Boolean(transport.token));
  const [user, setUser] = useState<Record<string, unknown> | undefined>(storedUser);
  const login = useCallback(async (username: string, password: string) => {
    const result = await transport.send<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    transport.setToken(result.token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.user));
    setUser(result.user);
    setAuthenticated(true);
  }, []);
  const logout = useCallback(async () => {
    try {
      await transport.send("/api/auth/logout", { method: "POST" });
    } finally {
      transport.setToken(null);
      localStorage.removeItem(USER_STORAGE_KEY);
      setUser(undefined);
      setAuthenticated(false);
    }
  }, []);
  const value = useMemo(
    () => ({ authenticated, user, login, logout }),
    [authenticated, user, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider is missing");
  return auth;
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 6,
          colorBgLayout: "#f5f7fb",
          colorText: "#172033",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        components: {
          Card: {
            borderRadiusLG: 12,
          },
          Drawer: {
            borderRadiusLG: 20,
          },
          Table: {
            headerBg: "#f8faff",
          },
          Form: {
            itemMarginBottom: 16,
          },
        },
      }}
    >
      <AntdApp>
        <AuthProvider>{children}</AuthProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
