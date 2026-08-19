import { Modal, Empty } from "antd";
import { useMemo } from "react";
import type { IFieldSchema, IFormSchema } from "@alien-form/react";
import type { SchemaHandlers } from "../types";
import { SchemaRenderer } from "./SchemaRenderer";
import { transformFieldForForm } from "../utils/transform";

export interface FieldDetailModalProps {
  open: boolean;
  title?: string;
  /** 当前字段的 schema（配置态或 form 态均可，内部会统一转换）。 */
  field?: IFieldSchema;
  /** 该字段的值。 */
  value?: unknown;
  handlers?: SchemaHandlers;
  onClose: () => void;
}

/**
 * 公共详情弹窗：接收单个字段的 value + schema，以 alien-form 的 detail 只读态渲染其完整内容。
 * table 下复杂字段点击“详情”即打开此弹窗。
 */
export function FieldDetailModal({
  open,
  title,
  field,
  value,
  handlers,
  onClose,
}: FieldDetailModalProps) {
  const schema = useMemo<IFormSchema | undefined>(() => {
    if (!field) return undefined;
    return {
      type: "object",
      properties: {
        __detail__: { ...transformFieldForForm(field), title: undefined },
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
          handlers={handlers}
          formKey={open ? "open" : "closed"}
        />
      ) : (
        <Empty description="暂无字段详情" />
      )}
    </Modal>
  );
}
