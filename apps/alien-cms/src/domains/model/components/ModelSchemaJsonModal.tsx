import { Alert, Modal, Spin } from 'antd';
import type { CmsModelSchema } from '@alien-form/cms';

interface ModelSchemaJsonModalProps {
  open: boolean;
  modelTitle?: string;
  schema?: CmsModelSchema;
  loading?: boolean;
  error?: Error | null;
  onClose: () => void;
}

export function ModelSchemaJsonModal({
  open,
  modelTitle,
  schema,
  loading,
  error,
  onClose,
}: ModelSchemaJsonModalProps) {
  return (
    <Modal
      title={modelTitle ? `${modelTitle} Schema JSON` : 'Schema JSON'}
      open={open}
      footer={null}
      width={720}
      onCancel={onClose}
    >
      {loading ? (
        <div className="model-page-loading">
          <Spin size="large" />
        </div>
      ) : error ? (
        <Alert type="error" showIcon message="Schema 加载失败" description={error.message} />
      ) : (
        <pre className="builder-json-preview">
          {schema ? JSON.stringify(schema, null, 2) : '暂无内容'}
        </pre>
      )}
    </Modal>
  );
}
