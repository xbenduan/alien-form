import { ConfigProvider, theme } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { useState } from "react";

const GLOBAL_GC_TIME = 10 * 60 * 1000; // 10 minutes

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,
            gcTime: GLOBAL_GC_TIME,
          },
        },
      }),
  );

  return (
    <ConfigProvider
      theme={{
        cssVar: true,
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 6,
          colorBgLayout: "#f5f7fb",
          colorText: "#172033",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ConfigProvider>
  );
}
