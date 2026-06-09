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
          title="\u670d\u52a1\u8fde\u63a5"
          styles={{ body: { padding: 20 } }}
        >
          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            \u914d\u7f6e\u540e\u7aef API \u5730\u5740\u548c\u767b\u5f55\u51ed\u8bc1\u3002\u7559\u7a7a\u5219\u4f7f\u7528\u672c\u5730\u6f14\u793a\u6a21\u5f0f\u3002
          </Typography.Paragraph>
          <Row gutter={[16, 0]}>
            <Col span={24}>
              <Form.Item label="API \u5730\u5740" name="baseUrl">
                <Input placeholder="https://your-api.workers.dev" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="\u7528\u6237\u540d" name="username">
                <Input placeholder="admin" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="\u5bc6\u7801" name="password">
                <Input.Password placeholder="\u2022\u2022\u2022\u2022\u2022\u2022" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card className="model-query-card system-settings-action-card" styles={{ body: { padding: 20 } }}>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={submitting}>
              \u4fdd\u5b58\u5e76\u7acb\u5373\u751f\u6548
            </Button>
          </Form.Item>
        </Card>
      </Flex>
    </Form>
  );
}
