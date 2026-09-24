import { Button, Drawer, Flex, Form, Input, Select } from "antd";
import { useEffect, useMemo, useRef } from "react";
import type { AlienExpression, AlienFieldSchema, AlienValue, Runtime } from "@alien-form/engine";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { FieldsetCard } from "../../../components/fieldset-card";
import { componentOptions, componentSample, synchronizeRelationForm } from "../builder/codec";
import type { FieldNode, FieldType } from "../builder/types";

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
  pattern?: string;
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

function parseJson(text: string | undefined, label: string): AlienValue | undefined {
  if (!text?.trim()) return undefined;
  try {
    return JSON.parse(text) as AlienValue;
  } catch {
    throw new Error(`${label} JSON 格式不合法`);
  }
}

function parseXValidate(text: string | undefined): AlienExpression | AlienExpression[] | undefined {
  const value = parseJson(text, "x-validate");
  if (value === undefined) return undefined;
  const rules = Array.isArray(value) ? value : [value];
  if (
    rules.some(
      (rule) =>
        typeof rule !== "string" || !rule.trim().startsWith("{{") || !rule.trim().endsWith("}}"),
    )
  ) {
    throw new Error("x-validate 只允许 {{...}} 表达式或表达式数组");
  }
  return value as AlienExpression | AlienExpression[];
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

const xValidateRule = {
  validator: (_rule: unknown, value: string | undefined) => {
    try {
      parseXValidate(value);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  },
};

const patternRule = {
  validator: (_rule: unknown, value: string | undefined) => {
    if (!value) return Promise.resolve();
    try {
      new RegExp(value);
      return Promise.resolve();
    } catch {
      return Promise.reject(new Error("正则表达式不合法"));
    }
  },
};

function toValues(node: FieldNode): FormFieldValues {
  const form = node.form as AlienFieldSchema & Record<string, unknown>;
  return {
    key: node.key,
    type: node.type,
    title: node.title,
    component: form.component,
    decorator: form.decorator as string | undefined,
    description: form.description,
    display: (form.display as string | undefined) ?? "visible",
    required: node.required,
    disabled: form.disabled as boolean | undefined,
    order: form.order as number | undefined,
    pattern: form.pattern,
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

/**
 * 「表单配置」字段抽屉：编辑 form-schema 表现，覆盖全部 IFieldSchema 字段。
 * physical 字段的 key/type 由数据库构建决定；required 由 nullable 派生。
 * virtual 字段可自由编辑。
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
  const isDbField = node?.source === "physical";
  const isSystem = node?.storage?.system === true;
  const isRelation = Boolean(node?.storage?.relation);
  // 记录初始组件：仅当新增字段且用户"改变"组件时才带出示例，避免打开即覆盖。
  const initialComponent = useRef<string | undefined>(undefined);
  const drawerTitle = useRef("编辑字段");
  if (open) drawerTitle.current = isNew ? "新增字段" : "编辑字段";

  useEffect(() => {
    if (open && node) {
      form.setFieldsValue(toValues(node));
      initialComponent.current = node.form.component;
    }
  }, [open, node, form]);

  const component = Form.useWatch("component", form);
  const selectedType = (Form.useWatch("type", form) ?? node?.type ?? "string") as FieldType;
  const options = useMemo(
    () => componentOptions(runtime, selectedType, domain),
    [runtime, selectedType, domain],
  );
  const supportsDataSource = Boolean(
    component && runtime.resolveComponent(component, domain)?.meta?.dataSource,
  );

  // 新增字段选组件带出示例 schema（编辑不带出）。
  const applySample = (nextComponent: string) => {
    if (!isNew || nextComponent === initialComponent.current) return;
    const sample = componentSample(runtime, nextComponent, domain) as
      | (Partial<AlienFieldSchema> & Record<string, unknown>)
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
    const parsedProps = parseJson(values.propsJson, "props") as
      | Record<string, AlienValue>
      | undefined;
    const parsedDecoratorProps = parseJson(values.decoratorPropsJson, "decoratorProps") as
      | Record<string, AlienValue>
      | undefined;

    const nextType = isDbField ? node.type : (values.type as FieldType);

    const nextForm: AlienFieldSchema & Record<string, unknown> = {
      ...(node.form as AlienFieldSchema),
      component: values.component,
      decorator: values.decorator || undefined,
      description: values.description || undefined,
      display:
        values.display && values.display !== "visible" ? (values.display as never) : undefined,
      disabled: values.disabled || undefined,
      order: values.order,
      pattern: values.pattern?.trim() || undefined,
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
      "x-validate": parseXValidate(values.validateJson),
    };

    const next: FieldNode = {
      ...node,
      key: isDbField ? node.key : values.key.trim(),
      type: nextType,
      title: values.title,
      required: values.required || undefined,
      form: synchronizeRelationForm(nextForm, nextType, node.storage?.relation),
      children: nextType === "object" || nextType === "array" ? (node.children ?? []) : undefined,
    };
    onSubmit(next);
  };

  return (
    <Drawer
      destroyOnHidden
      open={open}
      title={drawerTitle.current}
      width="min(720px, 100vw)"
      onClose={onCancel}
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button icon={<CloseOutlined />} onClick={onCancel}>
            取消
          </Button>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => void submit().catch(() => undefined)}
          >
            确认
          </Button>
        </Flex>
      }
    >
      <Form form={form} layout="vertical">
        <FieldsetCard title="基础">
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
            rules={[{ required: true, message: "请选择字段类型" }]}
            extra={isDbField ? "落库字段类型由数据库构建决定" : undefined}
          >
            <Select
              disabled={isDbField}
              options={["string", "number", "boolean", "object", "array", "void"].map((v) => ({
                label: v,
                value: v,
              }))}
              onChange={(type: FieldType) => {
                const current = form.getFieldValue("component");
                const nextOptions = componentOptions(runtime, type, domain);
                if (!nextOptions.some((option) => option.value === current)) {
                  form.setFieldValue("component", nextOptions[0]?.value);
                }
              }}
            />
          </Form.Item>
          <Form.Item name="title" label="表单标签">
            <Input placeholder="请输入" />
          </Form.Item>
          <Form.Item
            name="component"
            label="组件"
            rules={[
              {
                validator: (_rule, value) =>
                  !value || options.some((option) => option.value === value)
                    ? Promise.resolve()
                    : Promise.reject(new Error(`组件不支持 ${selectedType} 类型`)),
              },
            ]}
          >
            <Select
              options={options}
              disabled={isSystem || isRelation}
              showSearch
              onChange={applySample}
            />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入" rows={2} />
          </Form.Item>
        </FieldsetCard>
        <FieldsetCard title="属性">
          <Form.Item name="defaultJson" label="默认值" rules={[jsonRule("default")]}>
            <Input.TextArea rows={2} placeholder='"文本" 或 123 或 {"a":1}' />
          </Form.Item>
          {selectedType === "string" ? (
            <Form.Item name="pattern" label="正则表达式" rules={[patternRule]}>
              <Input placeholder="例如 ^[A-Za-z_][A-Za-z0-9_]*$" />
            </Form.Item>
          ) : null}
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
              <Input.TextArea
                disabled={isRelation}
                rows={3}
                placeholder='[{"label":"启用","value":"active"}]'
              />
            </Form.Item>
          ) : null}
          <Form.Item name="propsJson" label="组件 props(JSON)" rules={[jsonRule("props")]}>
            <Input.TextArea rows={3} placeholder='{"placeholder":"请输入"}' />
          </Form.Item>
          <Form.Item name="order" label="排序 order">
            <Input type="number" />
          </Form.Item>
          {/* start：暂时不启用以下字段 */}
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
        </FieldsetCard>
        <FieldsetCard title="高级">
          <Form.Item
            name="reactionJson"
            label="x-reaction 联动(JSON)"
            rules={[jsonRule("x-reaction")]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="effectJson" label="x-effect 副作用(JSON)" rules={[jsonRule("x-effect")]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="formatJson" label="x-format 格式化(JSON)" rules={[jsonRule("x-format")]}>
            <Input.TextArea rows={2} placeholder='{"input":"...","output":"..."}' />
          </Form.Item>
          <Form.Item name="validateJson" label="x-validate 复杂校验(JSON)" rules={[xValidateRule]}>
            <Input.TextArea rows={2} placeholder={'"{{ $service(\\"checkUnique\\")($value) }}"'} />
          </Form.Item>
        </FieldsetCard>
      </Form>
    </Drawer>
  );
}
