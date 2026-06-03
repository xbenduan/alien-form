import { Alert, Empty, Spin } from 'antd';
import type { CmsModelSchema, ModelActionMode, ModelActionOpenMode, ModelRecord } from '../types/record';
import { DetailSchemaView, SchemaFormView } from './SchemaRenderer';

interface RecordActionContentProps {
  mode: ModelActionMode;
  openMode: ModelActionOpenMode;
  formKey: string;
  schema: CmsModelSchema;
  record?: ModelRecord;
  loading?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmitAdd: (values: Record<string, unknown>) => Promise<void>;
  onSubmitEdit: (values: Record<string, unknown>) => Promise<void>;
}

export function RecordActionContent({
  mode,
  openMode,
  formKey,
  schema,
  record,
  loading,
  submitting,
  onClose,
  onSubmitAdd,
  onSubmitEdit,
}: RecordActionContentProps) {
  if (mode === 'detail') {
    if (loading) {
      return <Spin className="drawer-loading" />;
    }

    if (!record) {
      return <Empty description="暂无详情数据" />;
    }

    return <DetailSchemaView key={formKey} schema={schema} initialValues={record} />;
  }

  if (mode === 'edit') {
    if (loading) {
      return <Spin className="drawer-loading" />;
    }

    if (!record) {
      return <Alert type="warning" showIcon message="记录不存在或加载失败" />;
    }

    return (
      <SchemaFormView
        key={formKey}
        schema={schema}
        initialValues={record}
        submitText="保存修改"
        loading={submitting}
        layout={openMode === 'page' ? 'page' : 'overlay'}
        onCancel={onClose}
        onSubmit={onSubmitEdit}
      />
    );
  }

  if (mode === 'add') {
    return (
      <SchemaFormView
        key={formKey}
        schema={schema}
        submitText="创建记录"
        loading={submitting}
        layout={openMode === 'page' ? 'page' : 'overlay'}
        onCancel={onClose}
        onSubmit={onSubmitAdd}
      />
    );
  }

  return null;
}
