import { Modal, Empty } from "antd";
import { useMemo } from "react";
import type { IFieldSchema, IFormSchema } from "@alien-form/react";
import { SchemaRenderer } from "./SchemaRenderer";

export interface FieldDetailModalProps {
  open: boolean;
  title?: string;
  /** 已编译的 form 态字段 schema（table 列携带的 column.field）。 */
  field?: IFieldSchema;
  /** 该字段的值。 */
  value?: unknown;
  onClose: () => void;
}

/**
 * 公共详情弹窗：接收单个字段的 value + 已编译 schema，以 detail 只读态渲染其完整内容。
 * table 下复杂字段点击"详情"即打开此弹窗。
 */
export function FieldDetailModal({
  open,
  title,
  field,
  value,
  onClose,
}: FieldDetailModalProps) {
  const schema = useMemo<IFormSchema | undefined>(() => {
    if (!field) return undefined;
    return {
      type: "object",
      properties: {
        __detail__: { ...field, title: undefined },
      },
    };
  }, [field]);

  return (
    <Modal
      destroyOnHidden
      centered
      footer={null}
      width={640}
      title={title ? `${title}详情` : "字段详情"}
      open={open}
      onCancel={onClose}
    >
      {schema ? (
        <SchemaRenderer
          mode="detail"
          schema={schema}
          initialValues={{ __detail__: value }}
          formKey={open ? "open" : "closed"}
        />
      ) : (
        <Empty description="暂无字段详情" />
      )}
    </Modal>
  );
}
