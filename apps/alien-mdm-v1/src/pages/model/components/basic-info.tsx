import { Card, Form, Input, InputNumber, Select } from "antd";
import { useEffect } from "react";
import type { ModelAction, ModelDraft } from "../builder";

export function BasicInfo({
  draft,
  dispatch,
  lockName,
}: {
  draft: ModelDraft;
  dispatch: (action: ModelAction) => void;
  lockName?: boolean;
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue({
      name: draft.name,
      title: draft.title,
      subtitle: draft.subtitle,
      group: draft.group,
      singularLabel: draft.singularLabel,
      pluralLabel: draft.pluralLabel,
      defaultPageSize: draft.defaultPageSize,
      description: draft.description,
    });
  }, [draft, form]);

  const commit = (changed: Record<string, unknown>) => {
    const patch: Partial<ModelDraft> = {};
    if ("name" in changed) patch.name = String(changed.name ?? "");
    if ("title" in changed) patch.title = String(changed.title ?? "");
    if ("subtitle" in changed) patch.subtitle = changed.subtitle as string;
    if ("group" in changed) patch.group = String(changed.group ?? "other");
    if ("singularLabel" in changed) patch.singularLabel = changed.singularLabel as string;
    if ("pluralLabel" in changed) patch.pluralLabel = changed.pluralLabel as string;
    if ("defaultPageSize" in changed) patch.defaultPageSize = Number(changed.defaultPageSize ?? 20);
    if ("description" in changed) patch.description = changed.description as string;
    dispatch({ type: "meta.update", patch });
  };

  return (
    <Card>
      <Form
        form={form}
        layout="vertical"
        onValuesChange={(changed) => commit(changed)}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          columnGap: 16,
        }}
      >
        <Form.Item name="name" label="模型名" rules={[{ required: true }]}>
          <Input disabled={lockName} placeholder="字母/数字/下划线/中划线" />
        </Form.Item>
        <Form.Item name="title" label="标题" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="subtitle" label="副标题">
          <Input />
        </Form.Item>
        <Form.Item name="group" label="类型">
          <Select
            options={[
              { label: "系统", value: "system" },
              { label: "其他", value: "other" },
            ]}
          />
        </Form.Item>
        <Form.Item name="singularLabel" label="单数标签">
          <Input />
        </Form.Item>
        <Form.Item name="pluralLabel" label="复数标签">
          <Input />
        </Form.Item>
        <Form.Item name="defaultPageSize" label="每页条数">
          <InputNumber min={1} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="description" label="描述" style={{ gridColumn: "1 / -1" }}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Card>
  );
}
