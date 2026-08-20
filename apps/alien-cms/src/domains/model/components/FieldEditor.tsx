import { forwardRef, useEffect, useImperativeHandle } from "react";
import { Form, Input, Select, Switch } from "antd";
import type { BuilderFieldType, FieldDraft } from "../types";
import {
  FIELD_TYPE_META,
  FIELD_TYPE_OPTIONS,
  getDefaultPlaceholder,
  isContainerType,
} from "../utils";
import styles from "./FieldEditor.module.css";

interface FieldEditorProps {
  field: FieldDraft;
  onChange: (field: FieldDraft) => void;
}

export interface FieldEditorRef {
  submit: () => Promise<FieldDraft>;
}

function defaultSchemaJson(field: FieldDraft): string {
  const type =
    field.type === "object" || field.type === "array"
      ? field.type
      : field.type === "number" || field.type === "boolean"
        ? field.type
        : "string";
  const schema: Record<string, unknown> = {
    key: field.key,
    type,
    component: field.component,
    title: field.title || field.key,
    required: field.required,
    "x-table": { visible: field.tableVisible },
    ...(field.placeholder ? { props: { placeholder: field.placeholder } } : {}),
  };
  if (field.type === "object" && field.children) {
    schema.properties = Object.fromEntries(
      field.children.map((child) => [child.key, JSON.parse(defaultSchemaJson(child))]),
    );
  }
  if (field.type === "array" && field.children) {
    schema.items = {
      type: "object",
      properties: Object.fromEntries(
        field.children.map((child) => [child.key, JSON.parse(defaultSchemaJson(child))]),
      ),
    };
  }
  return JSON.stringify(schema, null, 2);
}

interface FieldFormValues extends Omit<FieldDraft, "children"> {}

function parseSchema(schemaJsonText: string): Record<string, unknown> | undefined {
  try {
    const schema = JSON.parse(schemaJsonText) as Record<string, unknown>;
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) return undefined;
    return schema;
  } catch {
    return undefined;
  }
}

function getFieldType(schema: Record<string, unknown>): BuilderFieldType | undefined {
  if (typeof schema.component === "string") {
    const componentType: Record<string, BuilderFieldType> = {
      Input: "string",
      NumberInput: "number",
      Switch: "boolean",
      DateInput: "date",
      Select: "select",
      MultiSelect: "multiSelect",
      TagsInput: "tags",
      ObjectField: "object",
      ArrayCards: "array",
    };
    if (componentType[schema.component]) return componentType[schema.component];
  }
  if (schema.type === "number" || schema.type === "boolean" || schema.type === "object") {
    return schema.type;
  }
  if (schema.type === "array") return "array";
  return schema.type === "string" ? "string" : undefined;
}

function schemaToFormValues(schema: Record<string, unknown>): Partial<FieldFormValues> {
  const props = schema.props && typeof schema.props === "object" ? schema.props : {};
  const table = schema["x-table"] && typeof schema["x-table"] === "object" ? schema["x-table"] : {};
  const type = getFieldType(schema);
  return {
    ...(typeof schema.key === "string" ? { key: schema.key } : {}),
    ...(typeof schema.title === "string"
      ? { title: schema.title }
      : typeof (props as Record<string, unknown>).title === "string"
        ? { title: (props as Record<string, unknown>).title as string }
        : {}),
    ...(type ? { type, component: FIELD_TYPE_META[type].component } : {}),
    ...(typeof (props as Record<string, unknown>).placeholder === "string"
      ? { placeholder: (props as Record<string, unknown>).placeholder as string }
      : {}),
    ...(typeof schema.required === "boolean" ? { required: schema.required } : {}),
    ...(typeof (table as Record<string, unknown>).visible === "boolean"
      ? { tableVisible: (table as Record<string, unknown>).visible as boolean }
      : {}),
    ...(typeof (table as Record<string, unknown>).width === "number"
      ? { tableWidthText: String((table as Record<string, unknown>).width) }
      : {}),
  };
}

function formValuesToSchema(
  schemaJsonText: string,
  values: Partial<FieldFormValues>,
): string | undefined {
  const schema = parseSchema(schemaJsonText);
  if (!schema) return undefined;
  const nextSchema = { ...schema };
  if (typeof values.key === "string") nextSchema.key = values.key;
  if (values.type) nextSchema.type = FIELD_TYPE_META[values.type].schemaType ?? "string";
  if (typeof values.component === "string") nextSchema.component = values.component;
  if (typeof values.title === "string") nextSchema.title = values.title;
  if (typeof values.required === "boolean") nextSchema.required = values.required;

  const props = {
    ...(schema.props && typeof schema.props === "object" ? schema.props : {}),
  } as Record<string, unknown>;
  if (typeof values.placeholder === "string") {
    if (values.placeholder) props.placeholder = values.placeholder;
    else delete props.placeholder;
  }
  if (Object.keys(props).length > 0) nextSchema.props = props;
  else delete nextSchema.props;

  const table = {
    ...(schema["x-table"] && typeof schema["x-table"] === "object" ? schema["x-table"] : {}),
    ...(typeof values.tableVisible === "boolean" ? { visible: values.tableVisible } : {}),
  } as Record<string, unknown>;
  if (values.tableWidthText) table.width = Number(values.tableWidthText);
  else delete table.width;
  nextSchema["x-table"] = table;

  return JSON.stringify(nextSchema, null, 2);
}

/** 单字段配置面板：使用 Ant Design Form 管理字段值、布局与校验。 */
export const FieldEditor = forwardRef<FieldEditorRef, FieldEditorProps>(function FieldEditor(
  { field, onChange },
  ref,
) {
  const [form] = Form.useForm<FieldFormValues>();
  const type = Form.useWatch("type", form) ?? field.type;
  const container = isContainerType(type);

  useEffect(() => {
    form.setFieldsValue({
      ...field,
      schemaJsonText: field.schemaJsonText || defaultSchemaJson(field),
    });
  }, [field.id, form]);

  useImperativeHandle(
    ref,
    () => ({
      submit: async () => {
        const values = await form.validateFields();
        return { ...field, ...values };
      },
    }),
    [field, form],
  );

  return (
    <Form
      form={form}
      layout="vertical"
      className={styles.form}
      onValuesChange={(changedValues, values) => {
        let nextValues = { ...values };

        if ("schemaJsonText" in changedValues) {
          const schema = parseSchema(String(values.schemaJsonText ?? ""));
          if (schema) {
            const schemaValues = schemaToFormValues(schema);
            nextValues = { ...nextValues, ...schemaValues };
            form.setFieldsValue(schemaValues);
          }
        } else {
          if (values.type) {
            nextValues = {
              ...nextValues,
              component: FIELD_TYPE_META[values.type].component,
              placeholder: getDefaultPlaceholder(values.type),
            };
            form.setFieldsValue({
              component: FIELD_TYPE_META[values.type].component,
              placeholder: getDefaultPlaceholder(values.type),
            });
          }
          const schemaJsonText = formValuesToSchema(values.schemaJsonText, nextValues);
          if (schemaJsonText) {
            nextValues.schemaJsonText = schemaJsonText;
            form.setFieldsValue({ schemaJsonText });
          }
        }

        onChange({ ...field, ...nextValues });
      }}
      initialValues={{
        ...field,
        schemaJsonText: field.schemaJsonText || defaultSchemaJson(field),
      }}
    >
      <Form.Item
        label="字段 Key"
        name="key"
        rules={[
          { required: true, whitespace: true, message: "请填写字段 Key" },
          { pattern: /^[a-zA-Z_][\w-]*$/, message: "字段 Key 只能使用字母、数字、下划线和中划线" },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="标题"
        name="title"
        rules={[{ required: true, whitespace: true, message: "请填写字段标题" }]}
      >
        <Input />
      </Form.Item>
      <Form.Item label="类型" name="type">
        <Select
          options={FIELD_TYPE_OPTIONS}
          onChange={(nextType) => {
            const fieldType = nextType as BuilderFieldType;
            form.setFieldsValue({
              component: FIELD_TYPE_META[fieldType].component,
              placeholder: getDefaultPlaceholder(fieldType),
            });
          }}
        />
      </Form.Item>

      {!container ? (
        <Form.Item label="占位提示" name="placeholder">
          <Input placeholder={getDefaultPlaceholder(type)} />
        </Form.Item>
      ) : null}

      {!container ? (
        <Form.Item layout="horizontal" label="必填" name="required" valuePropName="checked">
          <Switch />
        </Form.Item>
      ) : null}

      <Form.Item layout="horizontal" label="列表展示" name="tableVisible" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Form.Item
        name="schemaJsonText"
        className={styles.schemaJson}
        rules={[
          {
            validator: async (_, value: string) => {
              try {
                const parsed: unknown = JSON.parse(value);
                if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                  throw new Error("JSON Schema 必须是对象");
                }
              } catch (reason) {
                throw new Error(
                  reason instanceof Error ? reason.message : "JSON Schema 格式不正确",
                );
              }
            },
          },
        ]}
      >
        <Input.TextArea rows={12} spellCheck={false} />
      </Form.Item>
    </Form>
  );
});
