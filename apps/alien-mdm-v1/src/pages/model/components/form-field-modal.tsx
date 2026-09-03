import { Form, Input, Modal, Select, Tabs } from "antd";
import { useEffect, useMemo, useRef } from "react";
import type { FieldSchema, Runtime } from "@engine";
import { componentOptions, componentSample, typeForComponent, type FieldNode } from "../builder";

/**
 * 表单字段编辑器的表单值：覆盖 core IFieldSchema 的全部字段。
 * 复杂对象（props / x-reaction / x-effect / x-format / x-validate / decoratorProps /
 * dataSource / default）用 JSON 文本框编辑。
 */
interface FormFieldValues {
  key: string;
  type: string;
  title?: string;
  component?: string;
  decorator?: string;
  description?: string;
  display?: string;
  required?: boolean;
  disabled?: boolean;
  order?: number;
  "x-layout"?: string;
  defaultJson?: string;
  propsJson?: string;
  decoratorPropsJson?: string;
  dataSourceJson?: string;
  reactionJson?: string;
  effectJson?: string;
  formatJson?: string;
  validateJson?: string;
}

function toJson(value: unknown): string | undefined {
  return value === undefined ? undefined : JSON.stringify(value, null, 2);
}

function parseJson(text: string | undefined, label: string): unknown {
  if (!text?.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} JSON 格式不合法`);
  }
}

function toValues(node: FieldNode): FormFieldValues {
  const form = node.form as FieldSchema & Record<string, unknown>;
  return {
    key: node.key,
    type: node.type,
    title: form.title,
    component: form.component,
    decorator: form.decorator as string | undefined,
    description: form.description,
    display: (form.display as string | undefined) ?? "visible",
    required: node.form.required === true,
    disabled: form.disabled as boolean | undefined,
    order: form.order as number | undefined,
    "x-layout": form["x-layout"] as string | undefined,
    defaultJson: toJson(form.default),
    propsJson: toJson(form.props),
    decoratorPropsJson: toJson(form.decoratorProps),
    dataSourceJson: toJson(form.dataSource),
    reactionJson: toJson(form["x-reaction"]),
    effectJson: toJson(form["x-effect"]),
    formatJson: toJson(form["x-format"]),
    validateJson: toJson(form["x-validate"]),
  };
}

const jsonRule = (label: string) => ({
  validator: (_r: unknown, value: string) => {
    try {
      parseJson(value, label);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  },
});

/**
 * 「表单配置」字段弹窗：编辑 form-schema 表现，覆盖全部 IFieldSchema 字段。
 * 落库字段（source==="field"）：key 与 type 由数据库构建决定，此处锁定不可编辑；其余可编辑。
 * required 对落库字段由存储 nullable 派生（不在此编辑）；extra 字段全可编辑。
 * 新增字段时选择组件会带出该组件的示例 schema；编辑已有字段不自动带出。
 */
export function FormFieldModal({
  open,
  node,
  isNew,
  runtime,
  domain,
  existingKeys,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  node?: FieldNode;
  isNew?: boolean;
  runtime: Runtime;
  domain?: string;
  existingKeys: string[];
  onCancel: () => void;
  onSubmit: (node: FieldNode) => void;
}) {
  const [form] = Form.useForm<FormFieldValues>();
  const options = useMemo(() => componentOptions(runtime, domain), [runtime, domain]);
  const isDbField = node?.source === "field";
  const isSystem = node?.storage?.system === true;
  // 记录初始组件：仅当新增字段且用户"改变"组件时才带出示例，避免打开即覆盖。
  const initialComponent = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (open && node) {
      form.setFieldsValue(toValues(node));
      initialComponent.current = node.form.component;
    }
  }, [open, node, form]);

  const component = Form.useWatch("component", form);
  const supportsDataSource = Boolean(
    component && runtime.resolveComponent(component, domain)?.meta?.dataSource,
  );

  // 新增字段选组件带出示例 schema（编辑不带出）。
  const applySample = (nextComponent: string) => {
    if (!isNew || nextComponent === initialComponent.current) return;
    const sample = componentSample(runtime, nextComponent, domain) as
      | (Partial<FieldSchema> & Record<string, unknown>)
      | undefined;
    if (!sample) return;
    form.setFieldsValue({
      title: (sample.title as string | undefined) ?? form.getFieldValue("title"),
      propsJson: sample.props ? toJson(sample.props) : form.getFieldValue("propsJson"),
      dataSourceJson: sample.dataSource
        ? toJson(sample.dataSource)
        : form.getFieldValue("dataSourceJson"),
      display: (sample.display as string | undefined) ?? form.getFieldValue("display"),
    });
  };

  const submit = async () => {
    const values = await form.validateFields();
    if (!node) return;
    const parsedProps = parseJson(values.propsJson, "props") as Record<string, unknown> | undefined;
    const parsedDecoratorProps = parseJson(values.decoratorPropsJson, "decoratorProps") as
      | Record<string, unknown>
      | undefined;

    const nextType = isDbField
      ? node.type
      : values.component
        ? typeForComponent(runtime, values.component, domain)
        : node.type;

    const nextForm: FieldSchema & Record<string, unknown> = {
      ...(node.form as FieldSchema),
      title: values.title,
      component: values.component,
      decorator: values.decorator || undefined,
      description: values.description || undefined,
      display:
        values.display && values.display !== "visible" ? (values.display as never) : undefined,
      required: isDbField ? node.form.required : values.required,
      disabled: values.disabled || undefined,
      order: values.order,
      "x-layout": values["x-layout"] || undefined,
      default: parseJson(values.defaultJson, "default"),
      props: parsedProps && Object.keys(parsedProps).length ? parsedProps : undefined,
      decoratorProps:
        parsedDecoratorProps && Object.keys(parsedDecoratorProps).length
          ? parsedDecoratorProps
          : undefined,
      dataSource: parseJson(values.dataSourceJson, "dataSource") as never,
      "x-reaction": parseJson(values.reactionJson, "x-reaction") as never,
      "x-effect": parseJson(values.effectJson, "x-effect") as never,
      "x-format": parseJson(values.formatJson, "x-format") as never,
      "x-validate": parseJson(values.validateJson, "x-validate") as never,
    };

    const next: FieldNode = {
      ...node,
      key: isDbField ? node.key : values.key.trim(),
      type: nextType,
      form: nextForm,
      children: nextType === "object" || nextType === "array" ? (node.children ?? []) : undefined,
    };
    onSubmit(next);
  };

  return (
    <Modal
      centered
      destroyOnHidden
      open={open}
      title={isNew ? "新增字段" : "编辑字段"}
      width={800}
      okText="确认"
      cancelText="取消"
      onCancel={onCancel}
      onOk={submit}
    >
      <Form form={form} layout="vertical">
        <Tabs
          defaultActiveKey="basic"
          styles={{
            content: { height: "min(680px, calc(100vh - 250px))", overflowY: "auto" },
          }}
        >
          <Tabs.TabPane tab="基础" key="basic">
            <Form.Item
              name="key"
              label="字段 Key"
              rules={[
                { required: true, message: "请输入字段 Key" },
                {
                  pattern: /^[A-Za-z_][A-Za-z0-9_]*$/,
                  message: "只能用字母数字下划线，字母或下划线开头",
                },
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
            <Form.Item
              name="type"
              label="类型"
              extra={isDbField ? "落库字段类型由数据库构建决定" : undefined}
            >
              <Select
                disabled={isDbField}
                options={["string", "number", "boolean", "object", "array", "void"].map((v) => ({
                  label: v,
                  value: v,
                }))}
              />
            </Form.Item>
            <Form.Item name="title" label="表单标签">
              <Input placeholder="请输入" />
            </Form.Item>
            <Form.Item name="component" label="组件">
              <Select options={options} disabled={isSystem} showSearch onChange={applySample} />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea placeholder="请输入" rows={2} />
            </Form.Item>
          </Tabs.TabPane>
          <Tabs.TabPane tab="属性" key="attributes">
            <Form.Item name="defaultJson" label="默认值" rules={[jsonRule("default")]}>
              <Input.TextArea rows={2} placeholder='"文本" 或 123 或 {"a":1}' />
            </Form.Item>
            <Form.Item name="display" label="表单显隐">
              <Select
                placeholder="请选择"
                defaultValue="visible"
                options={[
                  { label: "显示", value: "visible" },
                  { label: "隐藏(hidden)", value: "hidden" },
                  { label: "不进表单(none)", value: "none" },
                ]}
              />
            </Form.Item>
            <Form.Item name="required" valuePropName="checked" hidden={isDbField}>
              <Select
                placeholder="请选择"
                defaultValue={true}
                options={[
                  { label: "必填", value: true },
                  { label: "非必填", value: false },
                ]}
              />
            </Form.Item>
            <Form.Item label="禁用" name="disabled" valuePropName="checked">
              <Select
                placeholder="请选择"
                defaultValue={true}
                options={[
                  { label: "禁用", value: true },
                  { label: "启用", value: false },
                ]}
              />
            </Form.Item>
            {supportsDataSource ? (
              <Form.Item
                name="dataSourceJson"
                label="选项数据源(JSON)"
                rules={[jsonRule("dataSource")]}
              >
                <Input.TextArea rows={3} placeholder='[{"label":"启用","value":"active"}]' />
              </Form.Item>
            ) : null}
            <Form.Item name="propsJson" label="组件 props(JSON)" rules={[jsonRule("props")]}>
              <Input.TextArea rows={3} placeholder='{"placeholder":"请输入"}' />
            </Form.Item>
            <Form.Item name="order" label="排序 order">
              <Input type="number" />
            </Form.Item>
            {/* start：暂时不启用以下字段 */}
            <Form.Item name="x-layout" label="x-layout（布局组件名）" hidden>
              <Input placeholder="void 布局组件" />
            </Form.Item>
            <Form.Item name="decorator" label="decorator（装饰器组件名）" hidden>
              <Input />
            </Form.Item>
            <Form.Item
              name="decoratorPropsJson"
              label="decoratorProps(JSON)"
              rules={[jsonRule("decoratorProps")]}
              hidden
            >
              <Input.TextArea rows={2} />
            </Form.Item>
            {/* end */}
          </Tabs.TabPane>
          <Tabs.TabPane tab="高级" key="advanced">
            <Form.Item
              name="reactionJson"
              label="x-reaction 联动(JSON)"
              rules={[jsonRule("x-reaction")]}
            >
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item
              name="effectJson"
              label="x-effect 副作用(JSON)"
              rules={[jsonRule("x-effect")]}
            >
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item
              name="formatJson"
              label="x-format 格式化(JSON)"
              rules={[jsonRule("x-format")]}
            >
              <Input.TextArea rows={2} placeholder='{"input":"...","output":"..."}' />
            </Form.Item>
            <Form.Item
              name="validateJson"
              label="x-validate 校验(JSON)"
              rules={[jsonRule("x-validate")]}
            >
              <Input.TextArea rows={2} />
            </Form.Item>
          </Tabs.TabPane>
        </Tabs>
      </Form>
    </Modal>
  );
}
