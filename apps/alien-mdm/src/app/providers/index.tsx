import { App as AntdApp, ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { LoginResponse } from "@app-types";
import { transport } from "@runtime/transport";
import { clearUserInfo, setUserInfo, userInfo, type UserInfo } from "@runtime/user-info";

interface AuthValue {
  authenticated: boolean;
  user?: UserInfo;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function AuthProvider({ children }: PropsWithChildren) {
  const [authenticated, setAuthenticated] = useState(() => Boolean(transport.token && userInfo()));
  const login = useCallback(async (username: string, password: string) => {
    const result = await transport.send<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setUserInfo(result.user);
    transport.setToken(result.token);
    window.location.reload();
  }, []);
  const logout = useCallback(async () => {
    try {
      await transport.send("/api/v1/auth/logout", { method: "POST" });
    } finally {
      transport.setToken(null);
      clearUserInfo();
      setAuthenticated(false);
    }
  }, []);
  useEffect(() => {
    // Session expiry (401) clears local auth state so Protected routes redirect to /login.
    transport.setUnauthorizedHandler(() => {
      clearUserInfo();
      setAuthenticated(false);
    });
    return () => transport.setUnauthorizedHandler(undefined);
  }, []);
  const value = useMemo(
    () => ({ authenticated, user: userInfo(), login, logout }),
    [authenticated, login, logout],
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
            bodyPadding: 16,
            bodyPaddingSM: 10,
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
