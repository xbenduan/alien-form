import { App } from "antd";
import {
  connectProvider,
  getCurrentProviderSnapshot,
  resetProvider,
} from "../../../data";
import type { AlienCmsConfig } from "../../../data";
import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ProviderSettingsForm } from "../components/ProviderSettingsForm";
import {
  configToFormValues,
  formValuesToConfig,
} from "../utils/provider-config";
import type { ProviderSettingsFormValues } from "../utils/provider-config";

export default function SystemSettingsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [snapshot, setSnapshot] = useState(() => getCurrentProviderSnapshot());
  const [submitting, setSubmitting] = useState(false);

  const initialValues = useMemo(
    () => configToFormValues((snapshot?.config as AlienCmsConfig | undefined) ?? undefined),
    [snapshot],
  );

  const isConnected = snapshot?.type === "http";

  const handleSave = useCallback(async (values: ProviderSettingsFormValues) => {
    setSubmitting(true);

    try {
      const config = formValuesToConfig(values);
      await connectProvider(config);

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
