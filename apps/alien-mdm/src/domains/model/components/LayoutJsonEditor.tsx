import { Alert, App, Button, Input } from "antd";
import { useEffect, useState } from "react";
import type { AfUiNode, ModelDraft } from "../../../compiler/shared";
import styles from "./index.module.css";

interface LayoutJsonEditorProps {
  layout: AfUiNode;
  onChange: (draft: ModelDraft) => void;
  draft: ModelDraft;
}

function isLayoutNode(value: unknown): value is AfUiNode {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const node = value as Partial<AfUiNode>;
  if (typeof node.component !== "string" || !node.component) {
    return false;
  }
  if (node.children !== undefined) {
    if (!Array.isArray(node.children) || !node.children.every(isLayoutNode)) return false;
  }
  if (node.slots !== undefined) {
    if (!node.slots || typeof node.slots !== "object" || Array.isArray(node.slots)) return false;
    if (
      !Object.values(node.slots).every(
        (slotNodes) => Array.isArray(slotNodes) && slotNodes.every(isLayoutNode),
      )
    ) {
      return false;
    }
  }
  return true;
}

export function LayoutJsonEditor({ draft, layout, onChange }: LayoutJsonEditorProps) {
  const { message } = App.useApp();
  const [text, setText] = useState(() => JSON.stringify(layout, null, 2));
  const [error, setError] = useState("");

  useEffect(() => {
    setText(JSON.stringify(layout, null, 2));
    setError("");
  }, [layout]);

  const apply = () => {
    try {
      const parsed: unknown = JSON.parse(text);
      if (!isLayoutNode(parsed)) throw new Error("x-layout 必须是合法的 UiNode 节点树");
      onChange({ ...draft, layout: parsed });
      setError("");
      message.success("页面布局已更新");
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "x-layout JSON 格式不正确";
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
        autoSize={{ minRows: 16, maxRows: 28 }}
        onChange={(event) => {
          setText(event.target.value);
          if (error) setError("");
        }}
      />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <div className={styles.actions}>
        <Button type="primary" onClick={apply}>
          更新布局
        </Button>
      </div>
    </div>
  );
}
