import type { CmsModelSchema, ModelActionMode, ModelActionOpenMode, ModelRecord } from '../types/record';
import { RecordActionContent } from './RecordActionContent';
import { RecordActionFrame } from './RecordActionFrame';

function buildActionMeta(mode: ModelActionMode, singularLabel: string) {
  switch (mode) {
    case 'add':
      return {
        title: `新增${singularLabel}`,
        drawerWidth: 680,
        modalWidth: 720,
      };
    case 'edit':
      return {
        title: `编辑${singularLabel}`,
        drawerWidth: 680,
        modalWidth: 720,
      };
    case 'detail':
      return {
        title: `${singularLabel}详情`,
        drawerWidth: 560,
        modalWidth: 640,
      };
    default:
      return {
        title: singularLabel,
        drawerWidth: 560,
        modalWidth: 640,
      };
  }
}

interface RecordActionHostProps {
  mode: ModelActionMode;
  openMode: ModelActionOpenMode;
  singularLabel: string;
  schema: CmsModelSchema;
  record?: ModelRecord;
  loading?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmitAdd: (values: Record<string, unknown>) => Promise<void>;
  onSubmitEdit: (values: Record<string, unknown>) => Promise<void>;
}

export function RecordActionHost({
  mode,
  openMode,
  singularLabel,
  schema,
  record,
  loading,
  submitting,
  onClose,
  onSubmitAdd,
  onSubmitEdit,
}: RecordActionHostProps) {
  if (mode === 'closed') {
    return null;
  }

  const meta = buildActionMeta(mode, singularLabel);
  const formKey = `${mode}:${record?.id ?? 'new'}`;

  return (
    <RecordActionFrame
      openMode={openMode}
      open
      title={meta.title}
      drawerWidth={meta.drawerWidth}
      modalWidth={meta.modalWidth}
      onClose={onClose}
    >
      <RecordActionContent
        mode={mode}
        openMode={openMode}
        formKey={formKey}
        schema={schema}
        record={record}
        loading={loading}
        submitting={submitting}
        onClose={onClose}
        onSubmitAdd={onSubmitAdd}
        onSubmitEdit={onSubmitEdit}
      />
    </RecordActionFrame>
  );
}
