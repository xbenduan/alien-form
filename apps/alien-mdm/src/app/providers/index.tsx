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
import type { ModelRecord } from "@alien-form/protocol";
import { sdkClient } from "@runtime/sdk-client";

interface AuthValue {
  authenticated: boolean;
  canManageModels: boolean;
  user: ModelRecord | null;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState(() => sdkClient.auth.model);
  const login = useCallback(async (username: string, password: string) => {
    const result = await sdkClient.auth.authWithPassword(username, password);
    setUser(result.user);
  }, []);
  const logout = useCallback(async () => {
    try {
      await sdkClient.auth.logout();
    } finally {
      setUser(null);
    }
  }, []);
  useEffect(() => {
    // Session expiry (401) clears local auth state so Protected routes redirect to /login.
    sdkClient.setUnauthorizedHandler(() => setUser(null));
    return () => sdkClient.setUnauthorizedHandler(undefined);
  }, []);
  const value = useMemo(
    () => ({
      authenticated: Boolean(sdkClient.auth.token && user),
      canManageModels: user?.canCreateModel === true,
      user,
      login,
      logout,
    }),
    [login, logout, user],
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
            borderRadiusLG: 8,
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
          Button: {
            textTextColor: "#1677ff",
            textTextHoverColor: "#4096ff",
            textTextActiveColor: "#0958d9",
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
