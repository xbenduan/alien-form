import { Alert, Checkbox, Form, Input, Modal, Select, Switch, Tabs } from "antd";
import { useEffect, useState } from "react";
import type { DatabaseColumnType, DatabaseRelation } from "@alien-form/engine";
import { useRuntime } from "@alien-form/react";
import type { ModelSummary } from "@app-types";
import {
  synchronizeRelationForm,
  type FieldNode,
  type FieldSource,
  type FieldType,
  type StorageConfig,
} from "../builder";

const COLUMN_TYPES: DatabaseColumnType[] = ["text", "integer", "real", "boolean", "date", "json"];

/** 虚拟字段可选的值类型（对应表单渲染类型，存入 data_content）。 */
const VALUE_TYPES: Exclude<FieldType, "void">[] = [
  "string",
  "number",
  "boolean",
  "object",
  "array",
];

/** 物理存储类型 → 应用值类型（table/表单类型）。 */
function valueTypeFor(type: DatabaseColumnType, current?: StorageConfig["valueType"]): FieldType {
  if (type === "integer" || type === "real") return "number";
  if (type === "boolean") return "boolean";
  if (type === "json") return current === "array" ? "array" : "object";
  return "string";
}

/** 值类型 → 物理存储类型（虚拟字段用于保持 StorageConfig 自洽，后端不落库）。 */
const COLUMN_FOR_VALUE: Record<Exclude<FieldType, "void">, DatabaseColumnType> = {
  string: "text",
  number: "real",
  boolean: "boolean",
  object: "json",
  array: "json",
};

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
  storageMode: FieldSource;
  columnType: DatabaseColumnType;
  valueType?: Exclude<FieldType, "void">;
  jsonValueType?: "object" | "array";
  column?: string;
  required?: boolean;
  unique?: boolean;
  index?: boolean;
  filterable?: boolean;
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
  const isVirtual = node.source === "virtual";
  const currentType = node.type === "void" ? "string" : node.type;
  return {
    key: node.key,
    title: storage?.title,
    storageMode: node.source,
    columnType: storage?.type ?? "text",
    valueType: isVirtual ? currentType : undefined,
    jsonValueType: storage?.valueType === "array" ? "array" : "object",
    column: storage?.column,
    required: storage?.nullable === false,
    unique: storage?.unique,
    index: storage?.index,
    filterable: storage?.filterable !== false,
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
 * 「数据库构建」字段弹窗：编辑 fields 的存储定义（storage / database / table / filter / relation）。
 * 存储方式选择器决定 physical（真实物理列）或 virtual（写入 data_content）。
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
  const runtime = useRuntime();
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const isSystem = node?.storage?.system === true;
  // 已发布字段不允许切换存储方式（避免破坏追加式物理约束）；key/物理类型/列名同样锁定。
  const storageLocked = isSystem || node?.persisted === true;

  useEffect(() => {
    if (open && node) {
      form.resetFields();
      form.setFieldsValue(toValues(node));
    }
  }, [open, node, form]);

  const storageMode = Form.useWatch("storageMode", form);
  const columnType = Form.useWatch("columnType", form);
  const relationEnabled = Form.useWatch("relationEnabled", form);
  const relationKind = Form.useWatch("relationKind", form);
  const isVirtual = storageMode === "virtual";
  const typeLocked = storageLocked || relationKind === "many-to-many";

  useEffect(() => {
    if (!open) return;
    let active = true;
    setModelsLoading(true);
    const listModels = runtime.getService("model.list") as () => Promise<ModelSummary[]>;
    void listModels()
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
  }, [open, runtime]);

  const submit = async () => {
    const values = await form.validateFields();
    if (!node) return;
    const virtual = values.storageMode === "virtual";
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
    // 值类型：多对多恒为数组；虚拟按所选值类型；物理由列类型派生。
    const valueType: FieldType = isMany
      ? "array"
      : virtual
        ? (values.valueType ?? "string")
        : valueTypeFor(values.columnType, values.jsonValueType);
    // 物理列类型：虚拟字段仅用于保持 StorageConfig 自洽（encode 时会丢弃 database）。
    const storageType: DatabaseColumnType = isMany
      ? "json"
      : virtual
        ? COLUMN_FOR_VALUE[valueType === "void" ? "string" : valueType]
        : values.columnType;
    const isJson = storageType === "json";
    const jsonValueType =
      valueType === "array" || valueType === "object"
        ? (valueType as "object" | "array")
        : undefined;
    const storage: StorageConfig = {
      ...node.storage,
      title: values.title?.trim() || undefined,
      type: storageType,
      valueType: isMany
        ? "array"
        : virtual
          ? jsonValueType
          : isJson
            ? (values.jsonValueType ?? "object")
            : undefined,
      column: virtual ? undefined : values.column?.trim() || undefined,
      system: node.storage?.system,
      nullable: virtual ? undefined : values.required ? false : undefined,
      unique: virtual ? undefined : values.unique || undefined,
      index: virtual ? undefined : values.index || undefined,
      filterable: values.filterable || undefined,
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
      source: values.storageMode,
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
      width={600}
      okText="确认"
      cancelText="取消"
      onCancel={onCancel}
      onOk={submit}
    >
      <Form form={form} layout="vertical">
        <Tabs
          defaultActiveKey="basic"
          styles={{ content: { minHeight: 320 } }}
          items={[
            {
              key: "basic",
              label: "基础",
              forceRender: true,
              children: (
                <>
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
                    <Input disabled={storageLocked} placeholder="例如 username" />
                  </Form.Item>
                  <Form.Item name="title" label="字段名称">
                    <Input placeholder="例如 账号" />
                  </Form.Item>
                  <Form.Item
                    name="storageMode"
                    label="存储方式"
                    extra={
                      isVirtual
                        ? "虚拟字段写入 data_content JSON，不创建物理列"
                        : "物理字段对应真实物理列，可索引与排序"
                    }
                  >
                    <Select
                      disabled={storageLocked}
                      options={[
                        { label: "物理（physical）", value: "physical" },
                        { label: "虚拟（virtual）", value: "virtual" },
                      ]}
                    />
                  </Form.Item>
                  {isVirtual ? (
                    <Form.Item name="valueType" label="值类型">
                      <Select
                        disabled={typeLocked}
                        options={VALUE_TYPES.map((value) => ({ label: value, value }))}
                      />
                    </Form.Item>
                  ) : (
                    <>
                      <Form.Item name="columnType" label="存储类型">
                        <Select
                          disabled={typeLocked}
                          options={COLUMN_TYPES.map((value) => ({ label: value, value }))}
                        />
                      </Form.Item>
                      {columnType === "json" ? (
                        <Form.Item name="jsonValueType" label="JSON 值类型">
                          <Select
                            disabled={typeLocked}
                            options={[
                              { label: "对象(object)", value: "object" },
                              { label: "数组(array)", value: "array" },
                            ]}
                          />
                        </Form.Item>
                      ) : null}
                    </>
                  )}
                </>
              ),
            },
            {
              key: "storage",
              label: "存储",
              forceRender: true,
              children: isVirtual ? (
                <>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="虚拟字段不创建物理列，值统一写入 data_content JSON，无法建立物理索引或唯一约束。"
                  />
                  <Form.Item name="filterable" valuePropName="checked">
                    <Checkbox>可筛选</Checkbox>
                  </Form.Item>
                  <Form.Item name="visible" valuePropName="checked">
                    <Checkbox>列表默认可见</Checkbox>
                  </Form.Item>
                </>
              ) : (
                <>
                  <Form.Item name="column" label="物理列名(缺省用 Key)">
                    <Input disabled={storageLocked} placeholder="snake_case" />
                  </Form.Item>
                  <Form.Item name="required" valuePropName="checked">
                    <Checkbox disabled={storageLocked}>必填(非空)</Checkbox>
                  </Form.Item>
                  <Form.Item name="unique" valuePropName="checked">
                    <Checkbox disabled={isSystem || node?.storage?.unique === true}>
                      唯一约束
                    </Checkbox>
                  </Form.Item>
                  <Form.Item name="index" valuePropName="checked">
                    <Checkbox disabled={isSystem || node?.storage?.index === true}>
                      建立索引
                    </Checkbox>
                  </Form.Item>
                  <Form.Item name="filterable" valuePropName="checked">
                    <Checkbox>可筛选</Checkbox>
                  </Form.Item>
                  <Form.Item name="visible" valuePropName="checked">
                    <Checkbox>列表默认可见</Checkbox>
                  </Form.Item>
                </>
              ),
            },
            {
              key: "relation",
              label: "关联",
              forceRender: true,
              children: (
                <>
                  <Form.Item name="relationEnabled" label="关联字段" valuePropName="checked">
                    <Switch disabled={storageLocked} />
                  </Form.Item>
                  {relationEnabled ? (
                    <>
                      <Form.Item name="relationKind" label="关系类型" rules={[{ required: true }]}>
                        <Select
                          disabled={storageLocked}
                          options={[
                            { label: "多对一", value: "many-to-one" },
                            { label: "多对多", value: "many-to-many" },
                          ]}
                          onChange={(kind) => {
                            if (kind === "many-to-many") {
                              form.setFieldsValue({
                                columnType: "json",
                                jsonValueType: "array",
                                valueType: "array",
                              });
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
                          disabled={storageLocked}
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
                          <Input disabled={storageLocked} placeholder="可选" />
                        </Form.Item>
                      ) : null}
                      <Form.Item name="relationValueField" label="值字段">
                        <Input disabled={storageLocked} placeholder="id" />
                      </Form.Item>
                      <Form.Item name="relationLabelField" label="展示字段">
                        <Input disabled={storageLocked} placeholder="name" />
                      </Form.Item>
                    </>
                  ) : null}
                </>
              ),
            },
          ]}
        />
      </Form>
    </Modal>
  );
}
