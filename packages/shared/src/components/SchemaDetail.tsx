import type { IFormSchema } from "@alien-form/core";
import { Empty, Modal } from "antd";
import { useMemo } from "react";
import { SchemaForm } from "./SchemaForm";
import type {
  DetailProjection,
  SchemaHandlers,
  SchemaRecord,
  TableColumnProjection,
} from "../types";

export function SchemaDetail({
  projection,
  handlers,
  loading,
}: {
  projection: DetailProjection;
  handlers?: SchemaHandlers;
  loading?: boolean;
}) {
  return (
    <SchemaForm
      mode="detail"
      schema={projection.schema}
      initialValues={projection.values}
      handlers={handlers}
      loading={loading}
      className="schema-detail"
    />
  );
}

export interface FieldDetailModalProps {
  open: boolean;
  column?: TableColumnProjection;
  record?: SchemaRecord;
  handlers?: SchemaHandlers;
  onClose: () => void;
}

export function FieldDetailModal({
  open,
  column,
  record,
  handlers,
  onClose,
}: FieldDetailModalProps) {
  const projection = useMemo<DetailProjection | undefined>(() => {
    if (!column || !record) return undefined;

    const schema = {
      type: "object",
      properties: {
        [column.key]: {
          ...column.field,
          title: undefined,
        },
      },
    } satisfies IFormSchema;
    return {
      schema,
      values: { [column.key]: record[column.key] },
    };
  }, [column, record]);

  return (
    <Modal
      destroyOnHidden
      title={column ? `${column.title}详情` : "字段详情"}
      open={open}
      width={640}
      centered
      footer={null}
      onCancel={onClose}
    >
      {projection ? (
        <SchemaDetail projection={projection} handlers={handlers} />
      ) : (
        <Empty description="暂无字段详情" />
      )}
    </Modal>
  );
}
