import { Button, Card, Space, Tag, Typography } from "antd";
import { SettingOutlined, DisconnectOutlined } from "@ant-design/icons";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  type FormConfig,
  type FormInstance,
  type IFormSchema,
} from "@alien-form/react";
import { useCallback, useEffect, useRef } from "react";
import {
  formComponents,
  formDecorators,
} from "../../../shared/components/SchemaFormShared";
import type { ProviderSettingsFormValues } from "../utils/provider-config";

const settingsSchema: IFormSchema = {
  type: "object",
  properties: {
    baseUrl: {
      type: "string",
      title: "API 地址",
      required: true,
      component: "Input",
      props: { placeholder: "https://your-api.example.com" },
      decorator: "FormItem",
    },
    username: {
      type: "string",
      title: "用户名",
      component: "Input",
      props: { placeholder: "admin", autoComplete: "username" },
      decorator: "FormItem",
    },
    password: {
      type: "string",
      title: "密码",
      component: "Input",
      props: { placeholder: "请输入密码", type: "password", autoComplete: "current-password" },
      decorator: "FormItem",
    },
  },
};

interface ProviderSettingsFormProps {
  initialValues?: ProviderSettingsFormValues;
  onFinish: (values: ProviderSettingsFormValues) => void | Promise<void>;
  submitting?: boolean;
  isConnected?: boolean;
  onDisconnect?: () => void;
}

export function ProviderSettingsForm({
  initialValues,
  onFinish,
  submitting,
  isConnected,
  onDisconnect,
}: ProviderSettingsFormProps) {
  const formRef = useRef<FormInstance | null>(null);

  const config: FormConfig = {
    schema: settingsSchema,
    initialValues,
  };

  const form = useCreateForm(config);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const handleSubmit = useCallback(async () => {
    if (!formRef.current) return;
    await formRef.current.submit(async (values) => {
      await onFinish(values as ProviderSettingsFormValues);
    });
  }, [onFinish]);

  return (
    <Card
      className="model-query-card system-settings-section-card"
      title="服务连接"
      extra={
        <Tag icon={<SettingOutlined />} color={isConnected ? "green" : "default"}>
          {isConnected ? "已连接" : "本地模式"}
        </Tag>
      }
      styles={{ body: { padding: 20 } }}
    >
      <div className="system-settings-section-header">
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          填写后端 API 地址和登录凭据，保存后系统将自动切换到远程数据源。
        </Typography.Paragraph>
      </div>

      <FormProvider
        form={form}
        components={formComponents as never}
        decorators={formDecorators as never}
      >
        <SchemaField />
      </FormProvider>

      <Space style={{ marginTop: 16 }}>
        <Button type="primary" loading={submitting} onClick={handleSubmit}>
          保存并连接
        </Button>
        {isConnected && onDisconnect ? (
          <Button icon={<DisconnectOutlined />} danger onClick={onDisconnect}>
            断开连接
          </Button>
        ) : null}
      </Space>
    </Card>
  );
}
