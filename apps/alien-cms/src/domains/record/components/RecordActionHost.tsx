import { Alert, Card, Drawer, Empty, Modal, Spin } from 'antd';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import type { CmsModelSchema, ModelActionMode, ModelActionOpenMode, ModelRecord } from '../types/record';
import { DetailSchemaView, SchemaFormView } from './SchemaRenderer';

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
  addSchema: CmsModelSchema;
  editSchema: CmsModelSchema;
  detailSchema: CmsModelSchema;
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
  addSchema,
  editSchema,
  detailSchema,
  record,
  loading,
  submitting,
  onClose,
  onSubmitAdd,
  onSubmitEdit,
}: RecordActionHostProps) {
  const open = mode !== 'closed';
  const meta = buildActionMeta(mode, singularLabel);
  const formKey = useMemo(() => `${mode}:${record?.id ?? 'new'}`, [mode, record?.id]);

  let content: ReactNode = null;

  if (mode === 'detail') {
    if (loading) {
      content = <Spin className="drawer-loading" />;
    } else if (!record) {
      content = <Empty description="暂无详情数据" />;
    } else {
      content = <DetailSchemaView key={formKey} schema={detailSchema} initialValues={record} />;
    }
  }

  if (mode === 'edit') {
    if (loading) {
      content = <Spin className="drawer-loading" />;
    } else if (!record) {
      content = <Alert type="warning" showIcon message="记录不存在或加载失败" />;
    } else {
      content = (
        <SchemaFormView
          key={formKey}
          schema={editSchema}
          initialValues={record}
          submitText="保存修改"
          loading={submitting}
          layout={openMode === 'page' ? 'page' : 'overlay'}
          onCancel={onClose}
          onSubmit={onSubmitEdit}
        />
      );
    }
  }

  if (mode === 'add') {
    content = (
      <SchemaFormView
        key={formKey}
        schema={addSchema}
        submitText="创建记录"
        loading={submitting}
        layout={openMode === 'page' ? 'page' : 'overlay'}
        onCancel={onClose}
        onSubmit={onSubmitAdd}
      />
    );
  }

  if (mode === 'closed') {
    return null;
  }

  if (openMode === 'page') {
    return (
      <Card className="model-action-page" styles={{ body: { padding: 24 } }}>
        <div className="model-action-page-body">{content}</div>
      </Card>
    );
  }

  if (openMode === 'modal') {
    return (
      <Modal
        centered
        destroyOnHidden
        footer={null}
        title={meta.title}
        open={open}
        width={meta.modalWidth}
        onCancel={onClose}
      >
        {content}
      </Modal>
    );
  }

  return (
    <Drawer
      destroyOnHidden
      title={meta.title}
      open={open}
      width={meta.drawerWidth}
      onClose={onClose}
    >
      {content}
    </Drawer>
  );
}
