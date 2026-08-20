import { App, Alert, Button, Input } from "antd";
import { useEffect, useState } from "react";
import type { ModelDraft, ModelSchema } from "../types";
import { schemaToDraft } from "../utils";
import styles from "./index.module.css";

interface SchemaJsonEditorProps {
  schema?: ModelSchema;
  onApply: (draft: ModelDraft) => void;
}

function stringifySchema(schema?: ModelSchema): string {
  return schema ? JSON.stringify(schema, null, 2) : "";
}

function isModelSchema(value: unknown): value is ModelSchema {
  if (!value || typeof value !== "object") return false;
  const schema = value as Partial<ModelSchema>;
  return Boolean(
    schema.meta &&
      typeof schema.meta === "object" &&
      typeof schema.properties === "object" &&
      schema.properties !== null &&
      !Array.isArray(schema.properties),
  );
}

/**
 * 内联 Schema JSON 编辑面板：整块 TextArea 展示/编辑模型 schema，
 * 点击「更新」才解析并应用到构建器草稿，应用结果通过弹窗提示。
 */
export function SchemaJsonEditor({ schema, onApply }: SchemaJsonEditorProps) {
  const { message } = App.useApp();
  const [text, setText] = useState(() => stringifySchema(schema));
  const [error, setError] = useState("");

  // 左侧字段变化时回显最新 schema（未点击更新前不会反向覆盖草稿）。
  useEffect(() => {
    setText(stringifySchema(schema));
    setError("");
  }, [schema]);

  const applySchema = () => {
    try {
      const parsed: unknown = JSON.parse(text);
      if (!isModelSchema(parsed)) {
        throw new Error("Schema 必须包含 meta 和 properties");
      }
      onApply(schemaToDraft(parsed));
      setError("");
      message.success("Schema 已更新");
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "Schema JSON 格式不正确";
      setError(detail);
      message.error(`更新失败：${detail}`);
    }
  };

  return (
    <div className={`${styles.schemaJsonEditor} ${styles.panel}`}>
      <Input.TextArea
        className={styles.input}
        value={text}
        spellCheck={false}
        onChange={(event) => {
          setText(event.target.value);
          if (error) setError("");
        }}
      />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <div className={styles.actions}>
        <Button type="primary" onClick={applySchema}>
          更新
        </Button>
      </div>
    </div>
  );
}
