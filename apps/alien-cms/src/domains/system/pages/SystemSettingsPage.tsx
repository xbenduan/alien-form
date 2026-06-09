import { App, Button, Space, Tag } from "antd";
import { SettingOutlined, DisconnectOutlined } from "@ant-design/icons";
import {
  createProviders,
  getCurrentProviderSnapshot,
  resetProvider,
  switchProvider,
} from "@alien-form/cms";
import type { AlienCmsConfig } from "@alien-form/cms";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkbenchLayout } from "../../../app/layout/WorkbenchLayout";
import { ProviderSettingsForm } from "../components/ProviderSettingsForm";
import {
  configToFormValues,
  formValuesToConfig,
} from "../utils/provider-config";
import type { ProviderSettingsFormValues } from "../utils/provider-config";

declare const fetch: (input: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
  text(): Promise<string>;
}>;

async function loginAndGetToken(baseUrl: string, username: string, password: string): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/auth/login`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`登录失败 (${response.status}): ${text}`);
  }

  const data = await response.json();
  const token = data?.data?.token ?? data?.token;

  if (!token) {
    throw new Error("登录响应中未找到 token。");
  }

  return token;
}

async function verifyConnection(config: AlienCmsConfig) {
  const providers = createProviders(config);
  const healthResult = await providers.healthCheck();

  if (!healthResult.ok) {
    throw new Error(healthResult.message ?? "服务连接失败");
  }

  // Try listing schemas to verify full access
  try {
    await providers.schemaProvider.list({
      pagination: { current: 1, pageSize: 1 },
    });
  } catch (error) {
    throw new Error(
      `服务已连通，但 Schemas 接口不可访问：${error instanceof Error ? error.message : "未知错误"}`,
    );
  }
}

export default function SystemSettingsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { setBreadcrumb } = useWorkbenchLayout();
  const [snapshot, setSnapshot] = useState(() => getCurrentProviderSnapshot());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setBreadcrumb({
      items: [{ title: "系统设置" }, { title: "服务连接" }],
    });
    return () => setBreadcrumb(null);
  }, [setBreadcrumb]);

  const initialValues = useMemo(
    () => configToFormValues((snapshot?.config as AlienCmsConfig | undefined) ?? undefined),
    [snapshot],
  );

  const isConnected = useMemo(() => {
    return snapshot?.type === "http";
  }, [snapshot]);

  const handleSave = useCallback(async (values: ProviderSettingsFormValues) => {
    setSubmitting(true);

    try {
      const config = formValuesToConfig(values);
      const baseUrl = config.baseUrl!;

      // Step 1: Login to get JWT token
      let token: string | undefined;
      if (config.auth?.username && config.auth?.password) {
        token = await loginAndGetToken(baseUrl, config.auth.username, config.auth.password);
      }

      // Step 2: Build final config with token in headers
      const finalConfig: AlienCmsConfig = {
        ...config,
        options: {
          ...config.options,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      };

      // Step 3: Verify the connection works
      await verifyConnection(finalConfig);

      // Step 4: Switch provider
      switchProvider("http", finalConfig);

      // Step 5: Invalidate caches
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["schemas"] }),
        queryClient.invalidateQueries({ queryKey: ["records"] }),
      ]);

      setSnapshot(getCurrentProviderSnapshot());
      message.success("服务连接成功");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "连接失败");
    } finally {
      setSubmitting(false);
    }
  }, [queryClient, message]);

  const handleDisconnect = useCallback(async () => {
    resetProvider();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["schemas"] }),
      queryClient.invalidateQueries({ queryKey: ["records"] }),
    ]);
    setSnapshot(getCurrentProviderSnapshot());
    message.success("已断开连接，切换回本地模式");
  }, [queryClient, message]);

  return (
    <ProviderSettingsForm
      initialValues={initialValues}
      onFinish={handleSave}
      submitting={submitting}
      isConnected={isConnected}
      onDisconnect={handleDisconnect}
    />
  );
}
