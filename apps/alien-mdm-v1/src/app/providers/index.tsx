import { App as AntdApp, ConfigProvider } from "antd";
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

interface AuthValue {
  authenticated: boolean;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function AuthProvider({ children }: PropsWithChildren) {
  const [authenticated, setAuthenticated] = useState(Boolean(transport.token));
  const login = useCallback(async (username: string, password: string) => {
    const result = await transport.send<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    transport.setToken(result.token);
    setAuthenticated(true);
  }, []);
  const logout = useCallback(async () => {
    try {
      await transport.send("/api/auth/logout", { method: "POST" });
    } finally {
      transport.setToken(null);
      setAuthenticated(false);
    }
  }, []);
  const value = useMemo(() => ({ authenticated, login, logout }), [authenticated, login, logout]);
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
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 6,
          colorBgLayout: "#f5f6f8",
        },
      }}
    >
      <AntdApp>
        <AuthProvider>{children}</AuthProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
