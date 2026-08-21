import { useRef } from "react";
import { Button, Drawer, Modal, Space, Spin } from "antd";
import type { IFormSchema, SchemaFormRef } from "@alien-form/shared";
import { useRecordDetail } from "../../../hooks";
import type { ModelSchema } from "../../../services";
import type { OverlayActionState } from "../types";
import { RecordActionForm } from "./RecordActionForm";
import styles from "./index.module.css";

interface RecordActionOverlayProps {
  modelName: string;
  schema: ModelSchema;
  /** 已编译的 form 场景 schema。 */
  formSchema: IFormSchema;
  overlay: OverlayActionState | null;
  submitting?: boolean;
  onClose: () => void;
  createRecord: (values: Record<string, unknown>) => Promise<unknown>;
  updateRecord: (id: string, values: Record<string, unknown>) => Promise<unknown>;
}

const TITLE: Record<OverlayActionState["mode"], string> = {
  add: "新增",
  edit: "编辑",
  detail: "详情",
};

/** drawer / modal 形态的记录动作容器。 */
export function RecordActionOverlay({
  modelName,
  schema,
  formSchema,
  overlay,
  submitting,
  onClose,
  createRecord,
  updateRecord,
}: RecordActionOverlayProps) {
  const open = Boolean(overlay);
  const mode = overlay?.mode ?? "add";
  const recordId = overlay?.recordId;
  const detailQuery = useRecordDetail(modelName, recordId, mode !== "add" && open);

  const title = `${TITLE[mode]}${schema.meta.singularLabel}`;
  const formKey = `${modelName}:${mode}:${recordId ?? "new"}`;
  const formRef = useRef<SchemaFormRef>(null);
  const loadingDetail = mode !== "add" && detailQuery.isFetching;
  const editable = mode !== "detail" && !loadingDetail;
  const footer = editable ? (
    <Space>
      <Button onClick={onClose}>取消</Button>
      <Button type="primary" loading={submitting} onClick={() => formRef.current?.submit()}>
        {mode === "add" ? "创建" : "保存"}
      </Button>
    </Space>
  ) : null;

  const body =
    loadingDetail ? (
      <div className={`${styles.recordActionOverlay} ${styles.loading}`}>
        <Spin />
      </div>
    ) : (
      <RecordActionForm
        mode={mode}
        formSchema={formSchema}
        record={mode === "add" ? undefined : detailQuery.data}
        formKey={formKey}
        formRef={formRef}
        submitting={submitting}
        onSubmitted={onClose}
        createRecord={createRecord}
        updateRecord={updateRecord}
      />
    );

  if (overlay?.openMode === "modal") {
    return (
      <Modal
        centered
        open={open}
        title={title}
        width={720}
        footer={footer}
        destroyOnHidden
        styles={{ body: { maxHeight: "calc(100vh - 220px)", overflowY: "auto" } }}
        onCancel={onClose}
      >
        {body}
      </Modal>
    );
  }

  return (
    <Drawer
      open={open}
      title={title}
      size={680}
      footer={footer}
      destroyOnHidden
      styles={{ body: { maxHeight: "calc(100vh - 120px)", overflowY: "auto" } }}
      onClose={onClose}
    >
      {body}
    </Drawer>
  );
}
