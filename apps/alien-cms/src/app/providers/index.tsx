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
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#C96442",
          borderRadius: 18,
          colorBgLayout: "#f4ede3",
          colorText: "#2f261f",
          fontFamily:
            "Inter, Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        components: {
          Card: {
            borderRadiusLG: 24,
          },
          Drawer: {
            borderRadiusLG: 28,
          },
          Table: {
            headerBg: "#f6efe4",
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
