import { SaveOutlined } from "@ant-design/icons";
import { Button, Space } from "antd";
import { useRef, useState, type ReactNode } from "react";
import type { FieldSchema, OpenMode } from "@alien-form/engine";
import { Overlay } from "./overlay";
import { RecordForm, type RecordActionMode, type RecordFormHandle } from "./record-form";

export function RecordActionOverlay({
  openMode,
  mode,
  modelCode,
  recordId,
  schema,
  title,
  ok,
  submit,
  onClose,
  onSaved,
}: {
  openMode: Exclude<OpenMode, "page">;
  mode: RecordActionMode;
  modelCode: string;
  recordId?: string;
  schema: FieldSchema;
  title: string;
  ok?: ReactNode;
  submit?: (
    values: Record<string, unknown>,
    context: { mode: RecordActionMode; modelCode: string; recordId?: string },
  ) => unknown | Promise<unknown>;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const formRef = useRef<RecordFormHandle>(null);
  const [submitting, setSubmitting] = useState(false);
  const footer = (
    <Space>
      <Button onClick={onClose}>{mode === "detail" ? "关闭" : "取消"}</Button>
      {mode !== "detail" && (
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={submitting}
          onClick={async () => {
            setSubmitting(true);
            try {
              await formRef.current?.submit();
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {ok ?? (mode === "add" ? "创建" : "保存")}
        </Button>
      )}
    </Space>
  );
  return (
    <Overlay open mode={openMode} title={title} footer={footer} onClose={onClose}>
      <RecordForm
        ref={formRef}
        embedded
        mode={mode}
        modelCode={modelCode}
        recordId={recordId}
        schema={schema}
        ok={ok}
        submit={submit}
        onCancel={onClose}
        onSaved={onSaved}
      />
    </Overlay>
  );
}
