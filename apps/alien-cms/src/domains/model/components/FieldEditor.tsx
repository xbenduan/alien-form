import { Input, Select, Switch } from "antd";
import type { FieldDraft } from "../types";
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

function defaultSchemaJson(field: FieldDraft): string {
  const type =
    field.type === "object" || field.type === "array"
      ? field.type
      : field.type === "number" || field.type === "boolean"
        ? field.type
        : "string";
  const schema: Record<string, unknown> = {
    type,
    component: field.component,
    title: field.title || field.key,
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

/** 单字段配置面板：类型、标题、组件行为、数据源与联动。 */
export function FieldEditor({ field, onChange }: FieldEditorProps) {
  const patch = (partial: Partial<FieldDraft>) => onChange({ ...field, ...partial });
  const container = isContainerType(field.type);
  const schemaJsonText = field.schemaJsonText || defaultSchemaJson(field);

  return (
    <div className={styles.editor}>
      <div className={styles.row}>
        <label className={styles.label}>字段 Key</label>
        <Input value={field.key} onChange={(event) => patch({ key: event.target.value })} />
      </div>
      <div className={styles.row}>
        <label className={styles.label}>标题</label>
        <Input value={field.title} onChange={(event) => patch({ title: event.target.value })} />
      </div>
      <div className={styles.row}>
        <label className={styles.label}>类型</label>
        <Select
          className={styles.control}
          value={field.type}
          options={FIELD_TYPE_OPTIONS}
          onChange={(type) =>
            patch({
              type,
              component: FIELD_TYPE_META[type].component,
              placeholder: getDefaultPlaceholder(type),
            })
          }
        />
      </div>

      {!container ? (
        <div className={styles.row}>
          <label className={styles.label}>占位提示</label>
          <Input
            value={field.placeholder}
            placeholder={getDefaultPlaceholder(field.type)}
            onChange={(event) => patch({ placeholder: event.target.value })}
          />
        </div>
      ) : null}

      {container ? null : (
        <div className={styles.row}>
          <label className={styles.label}>必填</label>
          <div>
            <Switch checked={field.required} onChange={(required) => patch({ required })} />
          </div>
        </div>
      )}

      <div className={styles.row}>
        <label className={styles.label}>列表展示</label>
        <Switch checked={field.tableVisible} onChange={(tableVisible) => patch({ tableVisible })} />
      </div>

      <div className={styles.row}>
        <label className={styles.label}>编辑 JSON</label>
        <Switch
          checked={field.jsonEnabled}
          onChange={(jsonEnabled) =>
            patch({
              jsonEnabled,
              schemaJsonText: jsonEnabled ? schemaJsonText : field.schemaJsonText,
            })
          }
        />
      </div>

      {field.jsonEnabled ? (
        <div className={styles.jsonRow}>
          <Input.TextArea
            rows={12}
            value={schemaJsonText}
            spellCheck={false}
            onChange={(event) => patch({ schemaJsonText: event.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}
