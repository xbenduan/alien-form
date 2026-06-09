import { Button, Card, Col, Flex, Form, Input, Row, Typography } from "antd";
import type { FormInstance } from "antd";
import type { ProviderSettingsFormValues } from "../utils/provider-config";

interface ProviderSettingsFormProps {
  form: FormInstance<ProviderSettingsFormValues>;
  onFinish: (values: ProviderSettingsFormValues) => void | Promise<void>;
  submitting?: boolean;
}

export function ProviderSettingsForm({ form, onFinish, submitting }: ProviderSettingsFormProps) {
  return (
    <Form<ProviderSettingsFormValues>
      className="system-settings-form"
      form={form}
      layout="horizontal"
      colon={false}
      labelAlign="left"
      labelCol={{ flex: "6em" }}
      wrapperCol={{ flex: 1 }}
      onFinish={onFinish}
    >
      <Flex vertical gap={16}>
        <Card
          className="model-query-card system-settings-section-card"
          title="服务连接"
          styles={{ body: { padding: 20 } }}
        >
          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            配置后端 API 地址和登录凭证。留空则使用本地演示模式。
          </Typography.Paragraph>
          <Row gutter={[16, 0]}>
            <Col span={24}>
              <Form.Item label="API 地址" name="baseUrl">
                <Input placeholder="https://your-api.workers.dev" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="用户名" name="username">
                <Input placeholder="admin" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="密码" name="password">
                <Input.Password placeholder="••••••" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card className="model-query-card system-settings-action-card" styles={{ body: { padding: 20 } }}>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={submitting}>
              保存并立即生效
            </Button>
          </Form.Item>
        </Card>
      </Flex>
    </Form>
  );
}
