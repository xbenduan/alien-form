import { Button, Card, Flex, Typography } from "antd";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  type FormConfig,
  type FormInstance,
  type IFormSchema,
} from "@alien-form/react";
import { useCallback, useEffect, useRef } from "react";
import { recordFormComponents, recordFormDecorators } from "../../../shared/adapters";
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
}

export function ProviderSettingsForm({ initialValues, onFinish, submitting }: ProviderSettingsFormProps) {
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
    <Flex vertical gap={16}>
      <Card
        className="model-query-card system-settings-section-card"
        title="服务连接"
        styles={{ body: { padding: 20 } }}
      >
        <div className="system-settings-section-header">
          <Typography.Paragraph type="secondary">
            填写后端 API 地址和登录凭据，保存后系统将自动切换到远程数据源。
          </Typography.Paragraph>
        </div>
        <FormProvider
          form={form}
          components={recordFormComponents as never}
          decorators={recordFormDecorators as never}
        >
          <SchemaField />
        </FormProvider>
      </Card>

      <Card className="model-query-card system-settings-action-card" styles={{ body: { padding: 20 } }}>
        <Button type="primary" loading={submitting} onClick={handleSubmit}>
          保存并连接
        </Button>
      </Card>
    </Flex>
  );
}
