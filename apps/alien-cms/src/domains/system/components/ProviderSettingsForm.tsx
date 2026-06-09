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
          <div className="system-settings-section-header">
            <Typography.Paragraph type="secondary">
              填写后端 API 地址和登录凭据，保存后系统将自动切换到远程数据源。
            </Typography.Paragraph>
          </div>
          <Row gutter={[16, 0]}>
            <Col span={24}>
              <Form.Item
                label="API 地址"
                name="baseUrl"
                rules={[{ required: true, message: "请输入后端 API 地址" }]}
              >
                <Input placeholder="https://your-api.example.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="用户名" name="username">
                <Input placeholder="admin" autoComplete="username" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="密码" name="password">
                <Input.Password placeholder="请输入密码" autoComplete="current-password" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card className="model-query-card system-settings-action-card" styles={{ body: { padding: 20 } }}>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={submitting}>
              保存并连接
            </Button>
          </Form.Item>
        </Card>
      </Flex>
    </Form>
  );
}
