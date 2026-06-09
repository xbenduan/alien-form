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
    throw new Error(error.error ?? `Login failed: HTTP ${resp.status}`);
  }

  const data = await resp.json();
  return data.data?.token ?? data.token;
}

async function verifyConnection(config: AlienCmsConfig) {
  if (!config.baseUrl) return;

  const providers = createProviders(config);
  const health = await providers.healthCheck();

  if (!health.ok) {
    throw new Error(health.message ?? "\u8fde\u63a5\u5931\u8d25");
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
      items: [{ title: "\u7cfb\u7edf\u8bbe\u7f6e" }, { title: "\u670d\u52a1\u8fde\u63a5" }],
    });
    return () => setBreadcrumb(null);
  }, [setBreadcrumb]);

  useEffect(() => {
    form.setFieldsValue(configToFormValues((snapshot?.config as AlienCmsConfig | undefined) ?? undefined));
  }, [form, snapshot]);

  const isRemote = useMemo(() => !!snapshot?.config?.baseUrl, [snapshot]);

  const handleSave = async (values: ProviderSettingsFormValues) => {
    setSubmitting(true);
    setSaveError(undefined);

    try {
      const config = formValuesToConfig(values);

      if (!config.baseUrl) {
        // Switch to local mode
        resetProvider();
      } else {
        // Login first to get token, then store in headers
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

        // Verify the connection works
        await verifyConnection(finalConfig);

        // Switch provider
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
      message.success("\u914d\u7f6e\u5df2\u4fdd\u5b58\u5e76\u751f\u6548");
    } catch (error) {
      const nextError = error instanceof Error ? error.message : "\u914d\u7f6e\u4fdd\u5b58\u5931\u8d25";
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
    message.success("\u5df2\u91cd\u7f6e\u4e3a\u672c\u5730\u6f14\u793a\u6a21\u5f0f");
  };

  return (
    <Flex vertical gap={16} className="system-settings-page">
      <Card className="model-query-card system-settings-hero-card" styles={{ body: { padding: 20 } }}>
        <Flex vertical gap={10}>
          <Flex align="center" justify="space-between" wrap="wrap" gap={16}>
            <div>
              <Typography.Title level={4} style={{ marginBottom: 6 }}>
                \u670d\u52a1\u8fde\u63a5
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                \u914d\u7f6e\u540e\u7aef\u670d\u52a1\u5730\u5740\u548c\u767b\u5f55\u51ed\u8bc1\uff0c\u6216\u4f7f\u7528\u672c\u5730\u6f14\u793a\u6a21\u5f0f\u3002
              </Typography.Paragraph>
            </div>
            <Space wrap size={10}>
              <Tag icon={<SettingOutlined />} color={isRemote ? "green" : "blue"}>
                {isRemote ? "\u8fdc\u7a0b\u6a21\u5f0f" : "\u672c\u5730\u6f14\u793a"}
              </Tag>
              {isRemote ? (
                <Button danger onClick={handleReset}>
                  \u91cd\u7f6e\u4e3a\u672c\u5730\u6a21\u5f0f
                </Button>
              ) : null}
            </Space>
          </Flex>

          {saveError ? <Alert type="error" showIcon message="\u8fde\u63a5\u5931\u8d25" description={saveError} /> : null}
        </Flex>
      </Card>

      <ProviderSettingsForm form={form} onFinish={handleSave} submitting={submitting} />
    </Flex>
  );
}
