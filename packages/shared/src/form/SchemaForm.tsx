import { useRef, type ReactNode } from "react";
import type { FormInstance } from "@alien-form/react";
import { App, Button, Drawer, Modal, Space } from "antd";
import type { FieldMode, SchemaConfig, SchemaHandlers, SchemaRecord } from "../types";
import { SchemaRenderer } from "../components/SchemaRenderer";
import { useFormSchema } from "./use-form-schema";

export interface SchemaFormProps {
  mode: FieldMode;
  /** 配置态 schema（内部转换为 form schema）。 */
  schema: SchemaConfig;
  dataSource?: SchemaRecord;
  handlers?: SchemaHandlers;
  formKey?: string | number;
  submitting?: boolean;
  submitText?: string;
  cancelText?: string;
  onSubmit?: (values: SchemaRecord, mode: Exclude<FieldMode, "detail">) => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * <SchemaForm />：完整渲染一份 schema，支持 add / edit / detail 三态。
 * detail 态只读且不显示提交按钮。
 */
export function SchemaForm({
  mode,
  schema,
  dataSource,
  handlers,
  formKey,
  submitting,
  submitText,
  cancelText = "取消",
  onSubmit,
  onCancel,
}: SchemaFormProps) {
  const { message } = App.useApp();
  const formRef = useRef<FormInstance | null>(null);
  const formSchema = useFormSchema(schema);
  const editable = mode !== "detail";

  const handleSubmit = async () => {
    const form = formRef.current;
    if (!form || !editable || !onSubmit) return;
    const valid = await form.validate();
    if (!valid) {
      message.warning(form.errors()[0]?.message ?? "请先修正表单校验错误");
      return;
    }
    await onSubmit(form.values(), mode);
  };

  return (
    <div className="af-form">
      <SchemaRenderer
        mode={mode}
        schema={formSchema}
        initialValues={dataSource}
        handlers={handlers}
        formKey={formKey}
        onFormReady={(form) => {
          formRef.current = form;
        }}
      />
      {editable && onSubmit ? (
        <div className="af-form-footer">
          <Space>
            {onCancel ? <Button onClick={onCancel}>{cancelText}</Button> : null}
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              {submitText ?? (mode === "add" ? "创建" : "保存")}
            </Button>
          </Space>
        </div>
      ) : null}
    </div>
  );
}

interface OverlayProps extends SchemaFormProps {
  open: boolean;
  title: ReactNode;
  width?: number;
  onClose: () => void;
}

/** 弹窗形态的表单。 */
export function ModalSchemaForm({ open, title, width = 720, onClose, ...formProps }: OverlayProps) {
  return (
    <Modal
      centered
      destroyOnHidden
      footer={null}
      title={title}
      open={open}
      width={width}
      onCancel={onClose}
    >
      <SchemaForm {...formProps} />
    </Modal>
  );
}

/** 抽屉形态的表单。 */
export function DrawerSchemaForm({ open, title, width = 680, onClose, ...formProps }: OverlayProps) {
  return (
    <Drawer destroyOnHidden footer={null} title={title} open={open} size={width} onClose={onClose}>
      <SchemaForm {...formProps} />
    </Drawer>
  );
}

/** 整页形态的表单。 */
export function PageSchemaForm(props: SchemaFormProps) {
  return (
    <div className="af-form-page">
      <SchemaForm {...props} />
    </div>
  );
}
