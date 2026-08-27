import { Modal, Empty } from "antd";
import { useMemo } from "react";
import {
  FormRenderer,
  useCreateForm,
  type IFieldSchema,
  type IFormSchema,
} from "@alien-form/react";
import { useOptionalPage } from "@alien-form/engine/react";
import { getFieldComponents, getFieldDecorators } from "../register/global/form/registry";
import { getAppRuntime } from "../runtime/create-runtime";

export interface FieldDetailModalProps {
  open: boolean;
  title?: string;
  /** 已编译的 form 态字段 schema（table 列携带的 column.field）。 */
  field?: IFieldSchema;
  /** 该字段的值。 */
  value?: unknown;
  onClose: () => void;
}

function DetailFieldForm({
  schema,
  value,
  formKey,
  domain,
}: {
  schema: IFormSchema;
  value: unknown;
  formKey: string;
  domain?: string;
}) {
  const scope = useMemo(() => ({ mode: "detail" }), []);
  const registry = getAppRuntime().registry;
  const components = useMemo(() => getFieldComponents(registry, domain), [domain, registry]);
  const decorators = useMemo(() => getFieldDecorators(registry, domain), [domain, registry]);
  const form = useCreateForm({ schema, initialValues: { __detail__: value }, scope }, [
    schema,
    value,
    formKey,
    scope,
  ]);
  return <FormRenderer form={form} components={components} decorators={decorators} />;
}

/**
 * 公共详情弹窗：接收单个字段的 value + 已编译 schema，以 detail 只读态渲染其完整内容。
 * table 下复杂字段点击"详情"即打开此弹窗。
 */
export function FieldDetailModal({ open, title, field, value, onClose }: FieldDetailModalProps) {
  const page = useOptionalPage();
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
        <DetailFieldForm
          schema={schema}
          formKey={open ? "open" : "closed"}
          value={value}
          domain={page?.domain}
        />
      ) : (
        <Empty description="暂无字段详情" />
      )}
    </Modal>
  );
}
