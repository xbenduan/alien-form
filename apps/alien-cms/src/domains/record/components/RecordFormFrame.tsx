import { useMemo, type FC } from "react";
import { DrawerSchemaForm, ModalSchemaForm } from "@alien-form/shared";
import { map as recordSchemaHandlers } from "../../../components/handlers";
import type {
  CmsModelSchema,
  ModelActionMode,
  ModelActionOpenMode,
  ModelRecord,
} from "../types/record";

function buildActionMeta(mode: ModelActionMode, singularLabel: string) {
  switch (mode) {
    case "add":
      return {
        title: `新增${singularLabel}`,
        drawerWidth: 680,
        modalWidth: 720,
      };
    case "edit":
      return {
        title: `编辑${singularLabel}`,
        drawerWidth: 680,
        modalWidth: 720,
      };
    case "detail":
      return {
        title: `${singularLabel}详情`,
        drawerWidth: 560,
        modalWidth: 640,
      };
    default:
      return {
        title: singularLabel,
        drawerWidth: 680,
        modalWidth: 720,
      };
  }
}

interface RecordFormFrameProps {
  open: boolean;
  openMode: Exclude<ModelActionOpenMode, "page">;
  mode: Exclude<ModelActionMode, "closed">;
  formKey: string;
  singularLabel: string;
  schema: CmsModelSchema;
  initialValues?: ModelRecord;
  loading?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmitAdd: (values: Record<string, unknown>) => Promise<void>;
  onSubmitEdit: (values: Record<string, unknown>) => Promise<void>;
}

const RecordFormFrame: FC<RecordFormFrameProps> = ({
  open,
  openMode,
  mode,
  formKey,
  singularLabel,
  schema,
  initialValues,
  loading,
  submitting,
  onClose,
  onSubmitAdd,
  onSubmitEdit,
}) => {
  const meta = buildActionMeta(mode, singularLabel);
  const actions = useMemo(
    () => ({
      onCancel: onClose,
      onSubmit: (values: Record<string, unknown>) =>
        mode === "add" ? onSubmitAdd(values) : onSubmitEdit(values),
    }),
    [mode, onClose, onSubmitAdd, onSubmitEdit],
  );

  if (openMode === "modal") {
    return (
      <ModalSchemaForm
        open={open}
        title={meta.title}
        width={meta.modalWidth}
        mode={mode}
        schema={schema}
        formKey={formKey}
        initialValues={initialValues}
        handlers={recordSchemaHandlers}
        actions={actions}
        loading={loading}
        submitting={submitting}
        onClose={onClose}
      />
    );
  }

  return (
    <DrawerSchemaForm
      open={open}
      title={meta.title}
      width={meta.drawerWidth}
      mode={mode}
      schema={schema}
      formKey={formKey}
      initialValues={initialValues}
      handlers={recordSchemaHandlers}
      actions={actions}
      loading={loading}
      submitting={submitting}
      onClose={onClose}
    />
  );
};

export default RecordFormFrame;
