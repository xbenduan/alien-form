import { useMemo, type FC } from "react";
import type { CmsModelSchema, ModelActionMode, ModelActionOpenMode, ModelRecord } from "../types/record";
import DrawerSchemaForm from "../../../shared/components/DrawerSchemaForm";
import ModalSchemaForm from "../../../shared/components/ModalSchemaForm";

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
  singularLabel,
  schema,
  initialValues,
  loading,
  submitting,
  onClose,
  onSubmitAdd,
  onSubmitEdit,
}) => {
  const meta = useMemo(() => buildActionMeta(mode, singularLabel), [mode, singularLabel]);

  if (openMode === "modal") {
    return (
      <ModalSchemaForm
        open={open}
        title={meta.title}
        width={meta.modalWidth}
        mode={mode}
        schema={schema}
        initialValues={initialValues}
        loading={loading}
        submitting={submitting}
        onClose={onClose}
        onSubmitAdd={onSubmitAdd}
        onSubmitEdit={onSubmitEdit}
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
      initialValues={initialValues}
      loading={loading}
      submitting={submitting}
      onClose={onClose}
      onSubmitAdd={onSubmitAdd}
      onSubmitEdit={onSubmitEdit}
    />
  );
};

export default RecordFormFrame;
