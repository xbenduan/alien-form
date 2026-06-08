import { Button, Card, Col, Flex, Form, Input, InputNumber, Row, Select, Typography } from "antd";
import type { ReactNode } from "react";
import type { FormInstance } from "antd";
import type { ProviderSettingsFormValues } from "../utils/provider-config";

interface ProviderSettingsFormProps {
  form: FormInstance<ProviderSettingsFormValues>;
  onFinish: (values: ProviderSettingsFormValues) => void | Promise<void>;
  submitting?: boolean;
}

const providerOptions = [
  { label: "本地模式", value: "local" },
  { label: "Supabase", value: "supabase" },
  { label: "HTTP API", value: "http" },
  { label: "TCB", value: "tcb" },
];

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className="model-query-card system-settings-section-card"
      title={title}
      styles={{ body: { padding: 20 } }}
    >
      {description ? (
        <div className="system-settings-section-header">
          <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>
        </div>
      ) : null}
      {children}
    </Card>
  );
}

function renderSupabaseFields() {
  return (
    <SectionCard title="Supabase 配置" description="配置 Supabase 项目连接信息以及表名映射。">
      <Row gutter={[16, 0]}>
        <Col span={24}>
          <Form.Item
            label="URL"
            name={["supabase", "url"]}
            rules={[{ required: true, message: "请输入 Supabase URL" }]}
          >
            <Input placeholder="https://your-project.supabase.co" />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item
            label="Anon Key"
            name={["supabase", "anonKey"]}
            rules={[{ required: true, message: "请输入 anonKey" }]}
          >
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} placeholder="your-anon-key" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="Schemas 表" name={["supabase", "tables", "schemas"]}>
            <Input placeholder="alien_cms_schemas" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="Records 表" name={["supabase", "tables", "records"]}>
            <Input placeholder="alien_cms_records" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="Logs 表" name={["supabase", "tables", "logs"]}>
            <Input placeholder="alien_cms_logs" />
          </Form.Item>
        </Col>
      </Row>
    </SectionCard>
  );
}

function renderHttpFields() {
  return (
    <Flex vertical gap={16}>
      <SectionCard title="HTTP 配置" description="配置 HTTP Provider 的基础服务地址。">
        <Row gutter={[16, 0]}>
          <Col span={24}>
            <Form.Item
              label="Base URL"
              name={["http", "baseUrl"]}
              rules={[{ required: true, message: "请输入 HTTP baseUrl" }]}
            >
              <Input placeholder="https://api.example.com" />
            </Form.Item>
          </Col>
        </Row>
      </SectionCard>

      <SectionCard title="Schema Endpoints" description="定义模型 Schema 的增删改查接口路径。">
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item label="List" name={["http", "endpoints", "schemas", "list"]}>
              <Input placeholder="/schemas" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Detail" name={["http", "endpoints", "schemas", "detail"]}>
              <Input placeholder="/schemas/:model" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Create" name={["http", "endpoints", "schemas", "create"]}>
              <Input placeholder="/schemas" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Update" name={["http", "endpoints", "schemas", "update"]}>
              <Input placeholder="/schemas/:model" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Delete" name={["http", "endpoints", "schemas", "delete"]}>
              <Input placeholder="/schemas/:model" />
            </Form.Item>
          </Col>
        </Row>
      </SectionCard>

      <SectionCard title="Record Endpoints" description="定义记录列表、详情和写入接口路径。">
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item label="List" name={["http", "endpoints", "records", "list"]}>
              <Input placeholder="/records/:model" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Detail" name={["http", "endpoints", "records", "detail"]}>
              <Input placeholder="/records/:model/:id" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Create" name={["http", "endpoints", "records", "create"]}>
              <Input placeholder="/records/:model" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Update" name={["http", "endpoints", "records", "update"]}>
              <Input placeholder="/records/:model/:id" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Delete" name={["http", "endpoints", "records", "delete"]}>
              <Input placeholder="/records/:model/:id" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Batch Delete" name={["http", "endpoints", "records", "batchDelete"]}>
              <Input placeholder="/records/:model/batch-delete" />
            </Form.Item>
          </Col>
        </Row>
      </SectionCard>

      <SectionCard title="Log Endpoints" description="定义日志查询与写入接口路径。">
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item label="List" name={["http", "endpoints", "logs", "list"]}>
              <Input placeholder="/logs" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Append" name={["http", "endpoints", "logs", "append"]}>
              <Input placeholder="/logs" />
            </Form.Item>
          </Col>
        </Row>
      </SectionCard>
    </Flex>
  );
}

function renderTcbFields() {
  return (
    <SectionCard title="TCB 配置" description="配置 CloudBase 环境与集合名称。">
      <Row gutter={[16, 0]}>
        <Col span={12}>
          <Form.Item
            label="Env ID"
            name={["tcb", "envId"]}
            rules={[{ required: true, message: "请输入 envId" }]}
          >
            <Input placeholder="your-env-id" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Region" name={["tcb", "region"]}>
            <Input placeholder="ap-shanghai" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="Schemas 集合" name={["tcb", "collections", "schemas"]}>
            <Input placeholder="alien_cms_schemas" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="Records 集合" name={["tcb", "collections", "records"]}>
            <Input placeholder="alien_cms_records" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="Logs 集合" name={["tcb", "collections", "logs"]}>
            <Input placeholder="alien_cms_logs" />
          </Form.Item>
        </Col>
      </Row>
    </SectionCard>
  );
}

export function ProviderSettingsForm({ form, onFinish, submitting }: ProviderSettingsFormProps) {
  const provider = Form.useWatch("provider", form) ?? "local";

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
        <SectionCard title="基础信息" description="配置名称、描述和当前要使用的 Provider 类型。">
          <Row gutter={[16, 0]}>
            <Col span={12}>
              <Form.Item
                label="配置名"
                name="name"
                rules={[{ required: true, message: "请输入配置名称" }]}
              >
                <Input placeholder="Alien CMS" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Provider"
                name="provider"
                rules={[{ required: true, message: "请选择 provider" }]}
              >
                <Select options={providerOptions} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="描述" name="description">
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} placeholder="可选的配置说明" />
              </Form.Item>
            </Col>
          </Row>
        </SectionCard>

        <SectionCard title="连接选项" description="配置超时、重试次数和额外请求头。">
          <Row gutter={[16, 0]}>
            <Col span={12}>
              <Form.Item label="超时(ms)" name={["options", "timeout"]}>
                <InputNumber min={0} precision={0} style={{ width: "100%" }} placeholder="10000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="重试次数" name={["options", "retries"]}>
                <InputNumber min={0} precision={0} style={{ width: "100%" }} placeholder="1" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="请求头" name={["options", "headersText"]}>
                <Input.TextArea
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  placeholder={'{\n  "x-api-key": "demo"\n}'}
                />
              </Form.Item>
            </Col>
          </Row>
        </SectionCard>

        {provider === "local" ? (
          <SectionCard title="本地模式" description="切换后会清除远端 provider 缓存，并回退到内置演示数据。">
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              本地模式适合本地体验和结构验证，不依赖外部服务连接。
            </Typography.Paragraph>
          </SectionCard>
        ) : null}

        {provider === "supabase" ? renderSupabaseFields() : null}
        {provider === "http" ? renderHttpFields() : null}
        {provider === "tcb" ? renderTcbFields() : null}

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
