import { Checkbox, Form, Input, Modal, Select } from "antd";
import { useEffect, useMemo } from "react";
import type { Runtime } from "@engine";
import { componentOptions, typeForComponent, type FieldNode } from "../builder";

interface FormFieldValues {
  key: string;
  title?: string;
  component?: string;
  placeholder?: string;
  description?: string;
  display?: string;
  required?: boolean;
  dataSourceJson?: string;
}

function toValues(node: FieldNode): FormFieldValues {
  return {
    key: node.key,
    title: node.form.title,
    component: node.form.component,
    placeholder: node.form.props?.placeholder as string | undefined,
    description: node.form.description,
    display: node.form.display ?? "visible",
    required: node.form.required,
    dataSourceJson: node.form.dataSource ? JSON.stringify(node.form.dataSource, null, 2) : undefined,
  };
}

/**
 * 「表单配置」字段弹窗：只编辑 form-schema 表现（component/props/display/description/dataSource
 * 以及表单标签/必填）。落库字段的 key/存储类型由「数据库构建」决定，此处只读展示、不可修改；
 * required 对落库字段由存储 nullable 派生，因此仅表单新增字段(extra)可编辑。
 */
export function FormFieldModal({
  open,
  node,
  runtime,
  domain,
  existingKeys,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  node?: FieldNode;
  runtime: Runtime;
  domain?: string;
  existingKeys: string[];
  onCancel: () => void;
  onSubmit: (node: FieldNode) => void;
}) {
  const [form] = Form.useForm<FormFieldValues>();
  const options = useMemo(() => componentOptions(runtime, domain), [runtime, domain]);
  // 落库字段：key、类型来自数据库构建，表单步骤不可改。
  const isDbField = node?.source === "field";
  const isSystem = node?.storage?.system === true;

  useEffect(() => {
    if (open && node) form.setFieldsValue(toValues(node));
  }, [open, node, form]);

  const component = Form.useWatch("component", form);
  const supportsDataSource = Boolean(
    component && runtime.resolveComponent(component, domain)?.meta?.dataSource,
  );

  const submit = async () => {
    const values = await form.validateFields();
    if (!node) return;
    const props = { ...node.form.props };
    if (values.placeholder) props.placeholder = values.placeholder;
    else delete props.placeholder;
    let dataSource = node.form.dataSource;
    if (values.dataSourceJson?.trim()) dataSource = JSON.parse(values.dataSourceJson);
    else dataSource = undefined;

    // 落库字段类型固定；仅表单新增字段(extra)可由组件推断类型。
    const nextType = isDbField
      ? node.type
      : values.component
        ? typeForComponent(runtime, values.component, domain)
        : node.type;

    const next: FieldNode = {
      ...node,
      key: isDbField ? node.key : values.key.trim(),
      type: nextType,
      form: {
        ...node.form,
        title: values.title,
        component: values.component,
        display: values.display && values.display !== "visible" ? values.display : undefined,
        description: values.description,
        required: isDbField ? node.form.required : values.required,
        props: Object.keys(props).length ? props : undefined,
        dataSource,
      },
      children:
        nextType === "object" || nextType === "array" ? (node.children ?? []) : undefined,
    };
    onSubmit(next);
  };

  return (
    <Modal
      centered
      destroyOnHidden
      open={open}
      title={node ? "编辑字段表现" : "新增展示字段"}
      width={560}
      okText="确认"
      cancelText="取消"
      onCancel={onCancel}
      onOk={submit}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="key"
          label="字段 Key"
          rules={[
            { required: true, message: "请输入字段 Key" },
            { pattern: /^[A-Za-z_][A-Za-z0-9_]*$/, message: "只能用字母数字下划线，字母或下划线开头" },
            {
              validator: (_rule, value) =>
                existingKeys.includes(String(value)) && value !== node?.key
                  ? Promise.reject(new Error("字段 Key 已存在"))
                  : Promise.resolve(),
            },
          ]}
          extra={isDbField ? "落库字段 Key 由数据库构建决定，不可修改" : undefined}
        >
          <Input disabled={isDbField} placeholder="例如 username" />
        </Form.Item>
        <Form.Item name="title" label="表单标签">
          <Input placeholder="例如 账号" />
        </Form.Item>
        <Form.Item name="component" label="组件">
          <Select options={options} disabled={isSystem} showSearch />
        </Form.Item>
        <Form.Item name="placeholder" label="占位提示">
          <Input placeholder="placeholder" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="display" label="表单显隐">
          <Select
            options={[
              { label: "显示", value: "visible" },
              { label: "隐藏(hidden)", value: "hidden" },
              { label: "不进表单(none)", value: "none" },
            ]}
          />
        </Form.Item>
        {!isDbField ? (
          <Form.Item name="required" valuePropName="checked">
            <Checkbox>必填</Checkbox>
          </Form.Item>
        ) : null}
        {supportsDataSource ? (
          <Form.Item
            name="dataSourceJson"
            label="选项数据源(JSON 数组)"
            rules={[
              {
                validator: (_r, value) => {
                  if (!value?.trim()) return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error("JSON 格式不合法"));
                  }
                },
              },
            ]}
          >
            <Input.TextArea rows={4} placeholder='[{"label":"启用","value":"active"}]' />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
}
