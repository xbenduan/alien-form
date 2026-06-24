import { Empty, Modal } from "../../../shared/ui";
import { useMemo } from 'react';
import type { CmsModelSchema, ModelRecord, TableColumnProjection } from '../types/record';
import { DetailSchemaView } from './SchemaRenderer';

interface FieldDetailDrawerProps {
  open: boolean;
  column?: TableColumnProjection;
  record?: ModelRecord;
  onClose: () => void;
}

export function FieldDetailDrawer({ open, column, record, onClose }: FieldDetailDrawerProps) {
  const schema = useMemo(
    () => (column
      ? {
          type: 'object',
          properties: {
            [column.key]: {
              ...column.field,
              title: undefined,
            },
          },
        } satisfies CmsModelSchema
      : undefined),
    [column],
  );
  const initialValues = useMemo(
    () => (column && record ? { [column.key]: record[column.key] } : undefined),
    [column, record],
  );
  const renderKey = `${record?.id ?? 'empty'}:${column?.key ?? 'field'}`;

  return (
    <Modal
      destroyOnHidden
      title={column ? `${column.title}详情` : '字段详情'}
      open={open}
      width={640}
      centered
      footer={null}
      onCancel={onClose}
    >
      {schema && initialValues ? (
        <DetailSchemaView key={renderKey} schema={schema} initialValues={initialValues} />
      ) : (
        <Empty description="暂无字段详情" />
      )}
    </Modal>
  );
}
