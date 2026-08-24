import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Form, Input, Select, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { getDefaultFieldSchema, getRegistryEntry } from "@alien-form/shared";
import type { ModelFieldSchema } from "../../../services";
import type { FieldDraft } from "../types";
import { FIELD_COMPONENT_OPTIONS, componentDescription } from "../utils";
import styles from "./index.module.css";

interface FieldEditorProps {
  field: FieldDraft;
  onChange: (field: FieldDraft) => void;
}

export interface FieldEditorRef {
  submit: () => Promise<FieldDraft>;
}

interface FieldFormValues {
  component: string;
  key: string;
  title?: string;
}

/**
 * 由表单直接管理、不在 JSON 编辑框透出的字段：
 *  - component / type / key / title：交给上方三个表单项修改（type 与 component 绑定，完全不透出）
 *  - properties / items：子字段由字段树（FieldListEditor）拖拽管理，不在此编辑
 *  - order：拖拽排序时生成，构建 schema 时统一重写
 */
const HIDDEN_KEYS = ["component", "type", "key", "title", "properties", "items", "order"] as const;

type SchemaRest = Record<string, unknown>;

function parseSchema(text: string): SchemaRest | undefined {
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as SchemaRest)
      : undefined;
  } catch {
    return undefined;
  }
}

/** 剔除由表单/字段树管理的键，得到 JSON 编辑框展示的「其余 schema」。 */
function stripHidden(schema: object): SchemaRest {
  const rest: SchemaRest = { ...(schema as SchemaRest) };
  for (const key of HIDDEN_KEYS) delete rest[key];
  return rest;
}

function stringify(rest: SchemaRest): string {
  return JSON.stringify(rest, null, 2);
}

/** component → 绑定的 schema type（多值组件降级为 string，容器为 object/array/void）。 */
function typeOfComponent(component: string): ModelFieldSchema["type"] {
  return getRegistryEntry(component)?.schema.type as ModelFieldSchema["type"];
}

/**
 * 单字段配置面板：
 *  - 表单仅三项，顺序为 选择组件 → key（必填）→ 标题（可空）
 *  - 选择组件后自动带入其注册的默认 schema 到下方 JSON 编辑框
 *  - JSON 编辑框只承载「其余 schema」；component/type/key/title 由表单控制、不可在 JSON 修改
 */
export const FieldEditor = forwardRef<FieldEditorRef, FieldEditorProps>(function FieldEditor(
  { field, onChange },
  ref,
) {
  const [form] = Form.useForm<FieldFormValues>();
  const initialComponent = field.fields.component ?? "Input";
  // 当前选中组件（用于「字段 Schema」旁展示组件说明 info）。
  const selectedComponent = Form.useWatch("component", form) ?? initialComponent;
  const description = componentDescription(selectedComponent);
  const [jsonText, setJsonText] = useState(() => stringify(stripHidden(field.fields)));
  const [jsonError, setJsonError] = useState(false);
  // 最近一次有效的「其余 schema」，供表单项改动时与 key/title/component 重新组合。
  const restRef = useRef<SchemaRest>(stripHidden(field.fields));

  useEffect(() => {
    form.setFieldsValue({
      component: field.fields.component ?? "Input",
      key: field.fields.key ?? "",
      title: field.fields.title ?? "",
    });
    const rest = stripHidden(field.fields);
    restRef.current = rest;
    setJsonText(stringify(rest));
    setJsonError(false);
  }, [field.id, form]);

  const compose = (component: string, key: string, title?: string): ModelFieldSchema =>
    ({
      ...restRef.current,
      component,
      type: typeOfComponent(component),
      key,
      title: title ?? "",
    }) as ModelFieldSchema;

  const emit = (component: string, key: string, title?: string) => {
    onChange({ ...field, fields: compose(component, key, title) });
  };

  useImperativeHandle(
    ref,
    () => ({
      submit: async () => {
        await form.validateFields();
        if (!parseSchema(jsonText)) {
          setJsonError(true);
          throw new Error("字段 Schema 不是合法的 JSON 对象");
        }
        const values = form.getFieldsValue();
        return {
          ...field,
          fields: compose(values.component, values.key, values.title),
        };
      },
    }),
    [field, form, jsonText],
  );

  const handleValuesChange = (changed: Partial<FieldFormValues>, all: FieldFormValues) => {
    // 切换组件：带入该组件注册的默认 schema（标题也同步为默认别名），key 保持不变。
    if (changed.component !== undefined) {
      const def = getDefaultFieldSchema(changed.component);
      const rest = stripHidden(def);
      restRef.current = rest;
      const nextTitle = typeof def.title === "string" ? def.title : "";
      setJsonText(stringify(rest));
      setJsonError(false);
      form.setFieldsValue({ title: nextTitle });
      emit(changed.component, all.key, nextTitle);
      return;
    }
    // key / title 改动：与当前 JSON 的其余 schema 重新组合。
    emit(all.component, all.key, all.title);
  };

  // JSON 改动：解析成功则更新其余 schema 并回传；失败仅提示、不覆盖已有草稿。
  const handleJsonChange = (text: string) => {
    setJsonText(text);
    const parsed = parseSchema(text);
    if (!parsed) {
      setJsonError(true);
      return;
    }
    setJsonError(false);
    restRef.current = stripHidden(parsed);
    const values = form.getFieldsValue();
    emit(values.component, values.key, values.title);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      className={`${styles.fieldEditor} ${styles.form}`}
      initialValues={{
        component: initialComponent,
        key: field.fields.key ?? "",
        title: field.fields.title ?? "",
      }}
      onValuesChange={handleValuesChange}
    >
      <Form.Item label="组件" name="component">
        <Select options={FIELD_COMPONENT_OPTIONS} />
      </Form.Item>
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
      <Form.Item label="标题" name="title">
        <Input placeholder="可留空" />
      </Form.Item>

      <Form.Item
        label={
          <span className={styles.schemaLabel}>
            字段 Schema
            {description ? (
              <Tooltip title={description}>
                <InfoCircleOutlined className={styles.schemaInfo} />
              </Tooltip>
            ) : null}
          </span>
        }
        className={styles.schemaJson}
        wrapperCol={{ span: 24 }}
        validateStatus={jsonError ? "error" : undefined}
        help={jsonError ? "请输入合法的 JSON 对象" : undefined}
      >
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
