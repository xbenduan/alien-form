import { Checkbox, Divider, Form, Input, Modal, Select, Switch } from "antd";
import { useEffect, useState } from "react";
import type { DatabaseColumnType, DatabaseRelation } from "@alien-form/engine";
import type { ModelSummary } from "@app-types";
import { transport } from "@runtime/transport";
import {
  synchronizeRelationForm,
  type FieldNode,
  type FieldType,
  type StorageConfig,
} from "../builder";

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
  relationEnabled?: boolean;
  relationKind?: DatabaseRelation["kind"];
  relationTarget?: string;
  relationThrough?: string;
  relationValueField?: string;
  relationLabelField?: string;
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
    relationEnabled: Boolean(storage?.relation),
    relationKind: storage?.relation?.kind ?? "many-to-one",
    relationTarget: storage?.relation?.target,
    relationThrough: storage?.relation?.through,
    relationValueField: storage?.relation?.valueField ?? "id",
    relationLabelField: storage?.relation?.labelField ?? "name",
  };
}

/**
 * 「数据库构建」字段弹窗：编辑 fields 存储定义。
 * relation 会按协议同步派生 RemoteSelect，其余表现仍由「表单配置」步骤负责。
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
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const isSystem = node?.storage?.system === true;

  useEffect(() => {
    if (open && node) {
      form.resetFields();
      form.setFieldsValue(toValues(node));
    }
  }, [open, node, form]);

  const columnType = Form.useWatch("columnType", form);
  const relationEnabled = Form.useWatch("relationEnabled", form);
  const relationKind = Form.useWatch("relationKind", form);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setModelsLoading(true);
    void transport
      .send<ModelSummary[]>("/api/schemas")
      .then((result) => {
        if (active) setModels(result);
      })
      .catch(() => {
        if (active) setModels([]);
      })
      .finally(() => {
        if (active) setModelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const submit = async () => {
    const values = await form.validateFields();
    if (!node) return;
    const relation: DatabaseRelation | undefined = values.relationEnabled
      ? {
          kind: values.relationKind ?? "many-to-one",
          target: values.relationTarget!.trim(),
          through:
            values.relationKind === "many-to-many"
              ? values.relationThrough?.trim() || undefined
              : undefined,
          valueField: values.relationValueField?.trim() || undefined,
          labelField: values.relationLabelField?.trim() || undefined,
        }
      : undefined;
    const isMany = relation?.kind === "many-to-many";
    const storageType = isMany ? "json" : values.columnType;
    const valueType = isMany ? "array" : valueTypeFor(storageType, values.jsonValueType);
    const isJson = storageType === "json";
    const storage: StorageConfig = {
      ...node.storage,
      title: values.title?.trim() || undefined,
      type: storageType,
      valueType: isMany ? "array" : isJson ? (values.jsonValueType ?? "object") : undefined,
      column: values.column?.trim() || undefined,
      nullable: values.required ? false : undefined,
      unique: values.unique || undefined,
      index: values.index || undefined,
      filterable: values.filterable || undefined,
      sortable: values.sortable || undefined,
      visible: values.visible === false ? false : undefined,
      relation,
    };
    // 落库字段必须在 form-schema 中有对应表现描述：类型变化时补默认 component，保留其余 form 配置。
    const nextForm = { ...node.form };
    if (!nextForm.component || node.type !== valueType) {
      nextForm.component = DEFAULT_COMPONENT[valueType];
    }
    const synchronizedForm = synchronizeRelationForm(nextForm, valueType, relation);
    const next: FieldNode = {
      ...node,
      key: values.key.trim(),
      type: valueType,
      storage,
      form: synchronizedForm,
      children:
        !relation && (valueType === "object" || valueType === "array")
          ? (node.children ?? [])
          : undefined,
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
        >
          <Input disabled={isSystem} placeholder="例如 username" />
        </Form.Item>
        <Form.Item name="title" label="字段名称">
          <Input placeholder="例如 账号" />
        </Form.Item>
        <Form.Item name="columnType" label="存储类型">
          <Select
            disabled={isSystem || relationKind === "many-to-many"}
            options={COLUMN_TYPES.map((value) => ({ label: value, value }))}
          />
        </Form.Item>
        {columnType === "json" ? (
          <Form.Item name="jsonValueType" label="JSON 值类型">
            <Select
              disabled={relationKind === "many-to-many"}
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
        <Divider titlePlacement="left">关联关系</Divider>
        <Form.Item name="relationEnabled" label="关联字段" valuePropName="checked">
          <Switch disabled={isSystem} />
        </Form.Item>
        {relationEnabled ? (
          <>
            <Form.Item name="relationKind" label="关系类型" rules={[{ required: true }]}>
              <Select
                disabled={isSystem}
                options={[
                  { label: "多对一", value: "many-to-one" },
                  { label: "多对多", value: "many-to-many" },
                ]}
                onChange={(kind) => {
                  if (kind === "many-to-many") {
                    form.setFieldsValue({ columnType: "json", jsonValueType: "array" });
                  }
                }}
              />
            </Form.Item>
            <Form.Item
              name="relationTarget"
              label="目标模型"
              rules={[{ required: true, message: "请选择目标模型" }]}
            >
              <Select
                disabled={isSystem}
                loading={modelsLoading}
                showSearch={{ optionFilterProp: ["label", "value"] }}
                options={models.map((model) => ({
                  label: `${model.title} (${model.name})`,
                  value: model.name,
                }))}
                placeholder="请选择目标模型"
              />
            </Form.Item>
            {relationKind === "many-to-many" ? (
              <Form.Item name="relationThrough" label="中间模型">
                <Input disabled={isSystem} placeholder="可选" />
              </Form.Item>
            ) : null}
            <Form.Item name="relationValueField" label="值字段">
              <Input disabled={isSystem} placeholder="id" />
            </Form.Item>
            <Form.Item name="relationLabelField" label="展示字段">
              <Input disabled={isSystem} placeholder="name" />
            </Form.Item>
          </>
        ) : null}
      </Form>
    </Modal>
  );
}
