import { ImportOutlined } from "@ant-design/icons";
import { Alert, Button, Input, Modal } from "antd";
import { useEffect, useState } from "react";
import type { ModelDraft, ModelSchema } from "../types";
import { schemaToDraft } from "../utils";
import styles from "./index.module.css";

interface SchemaJsonEditorProps {
  schema?: ModelSchema;
  onApply: (draft: ModelDraft) => void;
  compact?: boolean;
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

/** 原始 Schema 编辑入口：支持 JSON 修改后反向恢复构建器草稿。 */
export function SchemaJsonEditor({ schema, onApply, compact = false }: SchemaJsonEditorProps) {
  const [text, setText] = useState(() => stringifySchema(schema));
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

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
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Schema JSON 格式不正确");
    }
  };

  return (
    <div className={`${styles.schemaJsonEditor} ${styles.entry}${compact ? ` ${styles.compact}` : ""}`}>
      {!compact ? <div className={styles.caption}>通过 JSON 导入或恢复模型 Schema</div> : null}
      <Button
        icon={<ImportOutlined />}
        onClick={() => {
          setText(stringifySchema(schema));
          setError("");
          setOpen(true);
        }}
      >
        导入 Schema JSON
      </Button>
      <Modal
        centered
        destroyOnHidden
        open={open}
        title="导入 Schema JSON"
        width={760}
        okText="确认应用"
        cancelText="取消"
        styles={{ body: { maxHeight: "calc(100vh - 220px)", overflowY: "auto" } }}
        onCancel={() => {
          setOpen(false);
          setError("");
        }}
        onOk={applySchema}
      >
        <div className={styles.editor}>
          <Input.TextArea
            className={styles.input}
            value={text}
            spellCheck={false}
            autoSize={{ minRows: 22, maxRows: 36 }}
            onChange={(event) => {
              setText(event.target.value);
              if (error) setError("");
            }}
          />
          {error ? <Alert type="error" showIcon message={error} /> : null}
        </div>
      </Modal>
    </div>
  );
}
