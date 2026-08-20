import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Form, Input, Select, Switch } from "antd";
import type { ModelFieldSchema } from "../../../services";
import type { FieldDraft } from "../types";
import {
  FIELD_TYPE_COMPONENT_OPTIONS,
  FIELD_TYPE_META,
  getDefaultPlaceholder,
  inferFieldType,
  isContainerType,
} from "../utils";
import styles from "./index.module.css";

interface FieldEditorProps {
  field: FieldDraft;
  onChange: (field: FieldDraft) => void;
}

export interface FieldEditorRef {
  submit: () => Promise<FieldDraft>;
}

interface FieldFormValues {
  fields: ModelFieldSchema;
}

function parseSchema(text: string): ModelFieldSchema | undefined {
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as ModelFieldSchema)
      : undefined;
  } catch {
    return undefined;
  }
}

function stringify(fields: ModelFieldSchema): string {
  return JSON.stringify(fields, null, 2);
}

/** 精确路径合并：把 changedValues 里的字段按路径并入既有对象，其余键/顺序原样保留。 */
function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const prev = result[key];
    result[key] =
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev)
        ? deepMerge(prev as Record<string, unknown>, value as Record<string, unknown>)
        : value;
  }
  return result;
}

/**
 * 单字段配置面板：Form 直接绑定字段 schema 对象（含 key）。
 * - Key → ["fields", "key"]
 * - 标题 → ["fields", "title"]
 * - 类型 → ["fields", "component"]（同时联动 ["fields", "type"]）
 * - 占位 → ["fields", "props", "placeholder"]
 * - 必填 → ["fields", "required"]
 * - 列表展示 → ["fields", "x-table", "visible"]
 * - JSON 区直接是 fields 的序列化，任意字段改动都会在此回显。
 */
export const FieldEditor = forwardRef<FieldEditorRef, FieldEditorProps>(function FieldEditor(
  { field, onChange },
  ref,
) {
  const [form] = Form.useForm<FieldFormValues>();
  const [jsonText, setJsonText] = useState(() => stringify(field.fields));
  const component = Form.useWatch(["fields", "component"], form);
  const schemaType = Form.useWatch(["fields", "type"], form);
  const type = inferFieldType({ component, type: schemaType });
  const container = isContainerType(type);

  useEffect(() => {
    form.setFieldsValue({ fields: field.fields });
    setJsonText(stringify(field.fields));
  }, [field.id, form]);

  useImperativeHandle(
    ref,
    () => ({
      submit: async () => {
        await form.validateFields();
        return { ...field, fields: form.getFieldValue("fields") as ModelFieldSchema };
      },
    }),
    [field, form],
  );

  // 表单改动：按精确路径合并进「JSON 框内的完整对象」，只覆盖变化的路径，
  // 其余键（type / dataSource / 手写的自定义键）与顺序原样保留，不整体重置 JSON。
  const handleFormChange = (changedValues: { fields?: Partial<ModelFieldSchema> }) => {
    const patch = changedValues.fields;
    if (!patch) return;
    const base = (parseSchema(jsonText) ?? field.fields) as Record<string, unknown>;
    let next = deepMerge(base, patch as Record<string, unknown>) as ModelFieldSchema;

    // 类型（component）切换时联动 schema 的 type，并写回表单以保持 Select/开关一致。
    if (patch.component !== undefined) {
      const meta = Object.values(FIELD_TYPE_META).find((item) => item.component === next.component);
      next = { ...next, type: meta?.schemaType };
      form.setFieldsValue({ fields: { type: meta?.schemaType } });
    }

    setJsonText(stringify(next));
    onChange({ ...field, fields: next });
  };

  // JSON 框改动：整体替换 fields，并回填到表单各精确路径。
  const handleJsonChange = (text: string) => {
    setJsonText(text);
    const fields = parseSchema(text);
    if (fields) {
      form.setFieldsValue({ fields });
      onChange({ ...field, fields });
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      className={`${styles.fieldEditor} ${styles.form}`}
      initialValues={{ fields: field.fields }}
      onValuesChange={handleFormChange}
    >
      <Form.Item
        label="字段 Key"
        name={["fields", "key"]}
        rules={[
          { required: true, whitespace: true, message: "请填写字段 Key" },
          { pattern: /^[a-zA-Z_][\w-]*$/, message: "字段 Key 只能使用字母、数字、下划线和中划线" },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="标题"
        name={["fields", "title"]}
        rules={[{ required: true, whitespace: true, message: "请填写字段标题" }]}
      >
        <Input />
      </Form.Item>
      <Form.Item label="类型" name={["fields", "component"]}>
        <Select options={FIELD_TYPE_COMPONENT_OPTIONS} />
      </Form.Item>

      {!container ? (
        <Form.Item label="占位提示" name={["fields", "props", "placeholder"]}>
          <Input placeholder={getDefaultPlaceholder(type)} />
        </Form.Item>
      ) : null}

      {!container ? (
        <Form.Item
          layout="horizontal"
          label="必填"
          name={["fields", "required"]}
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      ) : null}

      <Form.Item
        layout="horizontal"
        label="列表展示"
        name={["fields", "x-table", "visible"]}
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>

      <Form.Item label="字段 Schema" className={styles.schemaJson} wrapperCol={{ span: 24 }}>
        <Input.TextArea
          rows={12}
          spellCheck={false}
          value={jsonText}
          onChange={(event) => handleJsonChange(event.target.value)}
        />
      </Form.Item>
    </Form>
  );
});
