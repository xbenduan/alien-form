import {
  App,
  Alert,
  Button,
  Card,
  Flex,
  Space,
  Tag,
  Typography,
  Upload,
} from "antd";
import type { UploadProps } from "antd";
import { DownloadOutlined, InboxOutlined, SettingOutlined } from "@ant-design/icons";
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
  buildSupabaseTemplate,
  configToFormValues,
  createDefaultFormValues,
  downloadConfigFile,
  formValuesToConfig,
  parseProviderConfigText,
} from "../utils/provider-config";
import type { ProviderSettingsFormValues } from "../utils/provider-config";

function getEffectiveProviderType(snapshot: { type: string; config: any } | null) {
  return snapshot?.type ?? "local";
}

function getSchemaStoreName(config: AlienCmsConfig) {
  const providerType = config.provider ?? "local";

  if (providerType === "supabase") {
    return config.supabase?.tables?.schemas ?? "alien_cms_schemas";
  }

  if (providerType === "tcb") {
    return config.tcb?.collections?.schemas ?? "alien_cms_schemas";
  }

  if (providerType === "http") {
    return config.http?.endpoints?.schemas?.list ?? "/api/schemas";
  }

  return "local";
}

function formatProviderCheckError(config: AlienCmsConfig, error: unknown) {
  const providerType = config.provider ?? "local";
  const detail = error instanceof Error ? error.message : "未知错误";
  const schemaStoreName = getSchemaStoreName(config);

  if (providerType === "supabase") {
    return `Supabase 连接已建立，但 Schemas 表 "${schemaStoreName}" 不可用：${detail}。当前前端使用 anon key，不能直接自动建表，请先在 Supabase 中创建该表并配置访问权限。`;
  }

  if (providerType === "tcb") {
    return `TCB 连接已建立，但 Schemas 集合 "${schemaStoreName}" 不可用：${detail}。当前前端没有直接初始化远端集合结构的能力，请先在 CloudBase 中创建该集合。`;
  }

  if (providerType === "http") {
    return `HTTP provider 已连通，但 Schemas 接口 "${schemaStoreName}" 不可访问：${detail}。当前通用 HTTP provider 不支持直接初始化，请先由后端提供 schemas 接口。`;
  }

  return detail;
}

async function verifyProviderConfig(config: AlienCmsConfig) {
  const providerType = config.provider ?? "local";

  if (providerType === "local") {
    return;
  }

  const providers = createProviders(config);
  const healthResult = await providers.healthCheck();

  if (!healthResult.ok) {
    throw new Error(formatProviderCheckError(config, healthResult.message ?? "连接失败"));
  }

  try {
    await providers.schemaProvider.list({
      pagination: {
        current: 1,
        pageSize: 1,
      },
    });
  } catch (error) {
    throw new Error(formatProviderCheckError(config, error));
  }
}

export default function SystemSettingsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { setBreadcrumb } = useWorkbenchLayout();
  const [form] = Form.useForm<ProviderSettingsFormValues>();
  const [snapshot, setSnapshot] = useState(() => getCurrentProviderSnapshot());
  const [uploadError, setUploadError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setBreadcrumb({
      items: [{ title: "系统设置" }, { title: "Provider 配置" }],
    });

    return () => setBreadcrumb(null);
  }, [setBreadcrumb]);

  useEffect(() => {
    form.setFieldsValue(configToFormValues((snapshot?.config as AlienCmsConfig | undefined) ?? undefined));
  }, [form, snapshot]);

  const currentProviderType = useMemo(() => getEffectiveProviderType(snapshot), [snapshot]);

  const handleDownloadTemplate = () => {
    downloadConfigFile(buildSupabaseTemplate());
  };

  const handleUploadConfig = async (file: File) => {
    try {
      const text = await file.text();
      const config = parseProviderConfigText(text);
      form.setFieldsValue(configToFormValues(config));
      setUploadError(undefined);
      message.success("配置文件已解析并回填到表单");
    } catch (error) {
      const nextError = error instanceof Error ? error.message : "配置文件解析失败";
      setUploadError(nextError);
    }
  };

  const uploadProps: UploadProps = {
    accept: ".json,application/json",
    showUploadList: false,
    beforeUpload: (file) => {
      void handleUploadConfig(file);
      return false;
    },
  };

  const handleSave = async (values: ProviderSettingsFormValues) => {
    setSubmitting(true);
    setSaveError(undefined);

    try {
      const config = formValuesToConfig(values);
      const providerType = config.provider ?? "local";

      await verifyProviderConfig(config);

      if (providerType === "local") {
        resetProvider();
      } else {
        switchProvider(providerType, config);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["schemas"] }),
        queryClient.invalidateQueries({ queryKey: ["records"] }),
      ]);

      const nextSnapshot = getCurrentProviderSnapshot();
      setSnapshot(nextSnapshot);
      form.setFieldsValue(
        providerType === "local"
          ? createDefaultFormValues()
          : configToFormValues((nextSnapshot?.config as AlienCmsConfig | undefined) ?? config),
      );
      message.success("Provider 配置已保存并生效");
    } catch (error) {
      const nextError = error instanceof Error ? error.message : "Provider 配置保存失败";
      setSaveError(nextError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flex vertical gap={16} className="system-settings-page">
      <Card className="model-query-card system-settings-hero-card" styles={{ body: { padding: 20 } }}>
        <Flex vertical gap={10}>
          <Flex align="center" justify="space-between" wrap="wrap" gap={16}>
            <div>
              <Typography.Title level={4} style={{ marginBottom: 6 }}>
                Provider 配置
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                上传并解析 `alien-cms.json`，或直接通过表单维护当前系统使用的数据 provider。
              </Typography.Paragraph>
            </div>
            <Space wrap size={10}>
              <Tag icon={<SettingOutlined />} color="blue">
                当前生效: {currentProviderType}
              </Tag>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                下载 Supabase 模板
              </Button>
              <Upload {...uploadProps}>
                <Button icon={<InboxOutlined />}>上传 alien-cms.json</Button>
              </Upload>
            </Space>
          </Flex>

          {uploadError ? <Alert type="error" showIcon message="配置文件解析失败" description={uploadError} /> : null}
          {saveError ? <Alert type="error" showIcon message="配置保存失败" description={saveError} /> : null}
        </Flex>
      </Card>

      <ProviderSettingsForm form={form} onFinish={handleSave} submitting={submitting} />
    </Flex>
  );
}
