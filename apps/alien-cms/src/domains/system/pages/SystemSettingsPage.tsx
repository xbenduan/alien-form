import { App, Alert, Button, Card, Flex, Space, Tag, Typography } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import { Form } from "antd";
import {
  createProviders,
  getCurrentProviderSnapshot,
  resetProvider,
  switchProvider,
} from "@alien-form/cms";
import type { AlienCmsConfig } from "@alien-form/cms";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkbenchLayout } from "../../../app/layout/WorkbenchLayout";
import { ProviderSettingsForm } from "../components/ProviderSettingsForm";
import {
  configToFormValues,
  createDefaultFormValues,
  formValuesToConfig,
} from "../utils/provider-config";
import type { ProviderSettingsFormValues } from "../utils/provider-config";

async function loginAndGetToken(baseUrl: string, username: string, password: string): Promise<string> {
  const resp = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!resp.ok) {
    const error = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(error.error ?? `登录失败: HTTP ${resp.status}`);
  }

  const data = await resp.json();
  return data.data?.token ?? data.token;
}

async function verifyConnection(config: AlienCmsConfig) {
  if (!config.baseUrl) return;

  const providers = createProviders(config);
  const health = await providers.healthCheck();

  if (!health.ok) {
    throw new Error(health.message ?? "连接失败");
  }
}

export default function SystemSettingsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { setBreadcrumb } = useWorkbenchLayout();
  const [form] = Form.useForm<ProviderSettingsFormValues>();
  const [snapshot, setSnapshot] = useState(() => getCurrentProviderSnapshot());
  const [saveError, setSaveError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setBreadcrumb({
      items: [{ title: "系统设置" }, { title: "服务连接" }],
    });
    return () => setBreadcrumb(null);
  }, [setBreadcrumb]);

  useEffect(() => {
    form.setFieldsValues(configToFormValues((snapshot?.config as AlienCmsConfig | undefined) ?? undefined));
  }, [form, snapshot]);

  const isRemote = useMemo(() => !!snapshot?.config?.baseUrl, [snapshot]);

  const handleSave = async (values: ProviderSettingsFormValues) => {
    setSubmitting(true);
    setSaveError(undefined);

    try {
      const config = formValuesToConfig(values);

      if (!config.baseUrl) {
        resetProvider();
      } else {
        // Login first to get token
        const token = await loginAndGetToken(
          config.baseUrl,
          config.auth?.username ?? "",
          config.auth?.password ?? "",
        );

        const finalConfig: AlienCmsConfig = {
          ...config,
          options: {
            ...config.options,
            headers: { Authorization: `Bearer ${token}` },
          },
        };

        await verifyConnection(finalConfig);
        switchProvider("http", finalConfig);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["schemas"] }),
        queryClient.invalidateQueries({ queryKey: ["records"] }),
      ]);

      const nextSnapshot = getCurrentProviderSnapshot();
      setSnapshot(nextSnapshot);
      form.setFieldsValue(
        !config.baseUrl
          ? createDefaultFormValues()
          : configToFormValues((nextSnapshot?.config as AlienCmsConfig | undefined) ?? config),
      );
      message.success("配置已保存并生效");
    } catch (error) {
      const nextError = error instanceof Error ? error.message : "配置保存失败";
      setSaveError(nextError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    resetProvider();
    queryClient.invalidateQueries({ queryKey: ["schemas"] });
    queryClient.invalidateQueries({ queryKey: ["records"] });
    setSnapshot(null);
    form.setFieldsValue(createDefaultFormValues());
    message.success("已重置为本地演示模式");
  };

  return (
    <Flex vertical gap={16} className="system-settings-page">
      <Card className="model-query-card system-settings-hero-card" styles={{ body: { padding: 20 } }}>
        <Flex vertical gap={10}>
          <Flex align="center" justify="space-between" wrap="wrap" gap={16}>
            <div>
              <Typography.Title level={4} style={{ marginBottom: 6 }}>
                服务连接
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                配置后端服务地址和登录凭证，或使用本地演示模式。
              </Typography.Paragraph>
            </div>
            <Space wrap size={10}>
              <Tag icon={<SettingOutlined />} color={isRemote ? "green" : "blue"}>
                {isRemote ? "远程模式" : "本地演示"}
              </Tag>
              {isRemote ? (
                <Button danger onClick={handleReset}>
                  重置为本地模式
                </Button>
              ) : null}
            </Space>
          </Flex>

          {saveError ? <Alert type="error" showIcon message="连接失败" description={saveError} /> : null}
        </Flex>
      </Card>

      <ProviderSettingsForm form={form} onFinish={handleSave} submitting={submitting} />
    </Flex>
  );
}
