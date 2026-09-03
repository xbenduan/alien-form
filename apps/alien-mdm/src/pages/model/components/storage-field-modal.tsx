import { Checkbox, Form, Input, Modal, Select } from "antd";
import { useEffect } from "react";
import type { DatabaseColumnType } from "@alien-form/engine";
import type { FieldNode, FieldType, StorageConfig } from "../builder";

const COLUMN_TYPES: DatabaseColumnType[] = ["text", "integer", "real", "boolean", "json"];

/** 存储类型 → 应用值类型（table/表单类型）。 */
function valueTypeFor(type: DatabaseColumnType, current?: StorageConfig["valueType"]): FieldType {
  if (type === "integer" || type === "real") return "number";
  if (type === "boolean") return "boolean";
  if (type === "json") return current === "array" ? "array" : "object";
  return "string";
}

/** 默认渲染组件（用于同步落库字段的 form 表现描述，界面不暴露）。 */
const DEFAULT_COMPONENT: Record<FieldType, string> = {
  string: "Input",
  number: "NumberInput",
  boolean: "Select",
  object: "ObjectField",
  array: "ArrayCards",
  void: "Input",
};

interface StorageFormValues {
  key: string;
  title?: string;
  columnType: DatabaseColumnType;
  jsonValueType?: "object" | "array";
  column?: string;
  required?: boolean;
  unique?: boolean;
  index?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  visible?: boolean;
}

function toValues(node: FieldNode): StorageFormValues {
  const storage = node.storage;
  return {
    key: node.key,
    title: storage?.title,
    columnType: storage?.type ?? "text",
    jsonValueType: storage?.valueType === "array" ? "array" : "object",
    column: storage?.column,
    required: storage?.nullable === false,
    unique: storage?.unique,
    index: storage?.index,
    filterable: storage?.filterable,
    sortable: storage?.sortable,
    visible: storage?.visible !== false,
  };
}

/**
 * 「数据库构建」字段弹窗：只编辑物理表 fields 的存储定义，不涉及任何 form-schema 内容。
 * 表现（component/props/display/dataSource）由「表单配置」步骤负责。
 */
export function StorageFieldModal({
  open,
  node,
  existingKeys,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  node?: FieldNode;
  existingKeys: string[];
  onCancel: () => void;
  onSubmit: (node: FieldNode) => void;
}) {
  const [form] = Form.useForm<StorageFormValues>();
  const isSystem = node?.storage?.system === true;

  useEffect(() => {
    if (open && node) form.setFieldsValue(toValues(node));
  }, [open, node, form]);

  const columnType = Form.useWatch("columnType", form);

  const submit = async () => {
    const values = await form.validateFields();
    if (!node) return;
    const valueType = valueTypeFor(values.columnType, values.jsonValueType);
    const isJson = values.columnType === "json";
    const storage: StorageConfig = {
      ...node.storage,
      title: values.title?.trim() || undefined,
      type: values.columnType,
      valueType: isJson ? (values.jsonValueType ?? "object") : undefined,
      column: values.column?.trim() || undefined,
      nullable: values.required ? false : undefined,
      unique: values.unique || undefined,
      index: values.index || undefined,
      filterable: values.filterable || undefined,
      sortable: values.sortable || undefined,
      visible: values.visible === false ? false : undefined,
    };
    // 落库字段必须在 form-schema 中有对应表现描述：类型变化时补默认 component，保留其余 form 配置。
    const nextForm = { ...node.form };
    if (!nextForm.component || node.type !== valueType) {
      nextForm.component = DEFAULT_COMPONENT[valueType];
    }
    const next: FieldNode = {
      ...node,
      key: values.key.trim(),
      type: valueType,
      storage,
      form: nextForm,
      children:
        valueType === "object" || valueType === "array" ? (node.children ?? []) : undefined,
    };
    onSubmit(next);
  };

  return (
    <Modal
      centered
      destroyOnHidden
      open={open}
      title={node ? "编辑字段" : "新增字段"}
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
        >
          <Input disabled={isSystem} placeholder="例如 username" />
        </Form.Item>
        <Form.Item name="title" label="字段名称">
          <Input placeholder="例如 账号" />
        </Form.Item>
        <Form.Item name="columnType" label="存储类型">
          <Select
            disabled={isSystem}
            options={COLUMN_TYPES.map((value) => ({ label: value, value }))}
          />
        </Form.Item>
        {columnType === "json" ? (
          <Form.Item name="jsonValueType" label="JSON 值类型">
            <Select
              options={[
                { label: "对象(object)", value: "object" },
                { label: "数组(array)", value: "array" },
              ]}
            />
          </Form.Item>
        ) : null}
        <Form.Item name="column" label="物理列名(缺省用 Key)">
          <Input disabled={isSystem} placeholder="snake_case" />
        </Form.Item>
        <Form.Item name="required" valuePropName="checked">
          <Checkbox disabled={isSystem}>必填(非空)</Checkbox>
        </Form.Item>
        <Form.Item name="unique" valuePropName="checked">
          <Checkbox disabled={isSystem}>唯一约束</Checkbox>
        </Form.Item>
        <Form.Item name="index" valuePropName="checked">
          <Checkbox disabled={isSystem}>建立索引</Checkbox>
        </Form.Item>
        <Form.Item name="filterable" valuePropName="checked">
          <Checkbox>可筛选</Checkbox>
        </Form.Item>
        <Form.Item name="sortable" valuePropName="checked">
          <Checkbox>可排序</Checkbox>
        </Form.Item>
        <Form.Item name="visible" valuePropName="checked">
          <Checkbox>列表默认可见</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
}
