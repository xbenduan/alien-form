import { Drawer, Modal, Spin } from "antd";
import { useRecordDetail } from "../../../hooks";
import type { ModelSchema } from "../../../services";
import type { OverlayActionState } from "../types";
import { RecordActionForm } from "./RecordActionForm";
import styles from "./RecordActionOverlay.module.css";

interface RecordActionOverlayProps {
  modelName: string;
  schema: ModelSchema;
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

  const body =
    mode !== "add" && detailQuery.isFetching ? (
      <div className={styles.loading}>
        <Spin />
      </div>
    ) : (
      <RecordActionForm
        mode={mode}
        schema={schema}
        record={mode === "add" ? undefined : detailQuery.data}
        formKey={formKey}
        submitting={submitting}
        onCancel={onClose}
        onSubmitted={onClose}
        createRecord={createRecord}
        updateRecord={updateRecord}
      />
    );

  if (overlay?.openMode === "modal") {
    return (
      <Modal open={open} title={title} width={720} footer={null} destroyOnHidden onCancel={onClose}>
        {body}
      </Modal>
    );
  }

  return (
    <Drawer open={open} title={title} size={680} footer={null} destroyOnHidden onClose={onClose}>
      {body}
    </Drawer>
  );
}
