import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { FormInstance, IFormSchema } from "@alien-form/react";
import { App, Drawer, Modal, Space, Button } from "antd";
import type { FieldMode, SchemaRecord } from "../types";
import { SchemaRenderer } from "../components/SchemaRenderer";

export interface SchemaFormProps {
  mode: FieldMode;
  /** 已编译的 form 场景 schema（由 SchemaCompiler.compile 产出）。 */
  formSchema: IFormSchema;
  dataSource?: SchemaRecord;
  formKey?: string | number;
  submitting?: boolean;
  submitText?: string;
  cancelText?: string;
  onSubmit?: (values: SchemaRecord, mode: Exclude<FieldMode, "detail">) => void | Promise<void>;
}

export interface SchemaFormRef {
  form: FormInstance | null;
  submit: () => Promise<void>;
}

/**
 * <SchemaForm />：渲染一份已编译的 form schema，支持 add / edit / detail 三态。
 * detail 态只读且不显示提交按钮。
 */
export const SchemaForm = forwardRef<SchemaFormRef, SchemaFormProps>(function SchemaForm(
  { mode, formSchema, dataSource, formKey, onSubmit },
  ref,
) {
  const { message } = App.useApp();
  const formRef = useRef<FormInstance | null>(null);
  const [form, setForm] = useState<FormInstance | null>(null);
  const editable = mode !== "detail";

  const handleSubmit = useCallback(async () => {
    const form = formRef.current;
    if (!form || !editable || !onSubmit) return;
    const valid = await form.validate();
    if (!valid) {
      message.warning(form.errors()[0]?.message ?? "请先修正表单校验错误");
      return;
    }
    await onSubmit(form.values(), mode);
  }, [editable, message, mode, onSubmit]);

  useImperativeHandle(ref, () => ({ form, submit: handleSubmit }), [form, handleSubmit]);

  return (
    <div className="af-form">
      <SchemaRenderer
        mode={mode}
        schema={formSchema}
        initialValues={dataSource}
        formKey={formKey}
        onFormReady={(form) => {
          formRef.current = form;
          setForm(form);
        }}
      />
    </div>
  );
});

interface OverlayProps extends SchemaFormProps {
  open: boolean;
  title: ReactNode;
  width?: number;
  onClose: () => void;
}

/** 弹窗形态的表单。 */
export function ModalSchemaForm({ open, title, width = 720, onClose, ...formProps }: OverlayProps) {
  const formRef = useRef<SchemaFormRef>(null);
  const editable = formProps.mode !== "detail" && Boolean(formProps.onSubmit);
  return (
    <Modal
      centered
      destroyOnHidden
      footer={
        editable ? (
          <Space>
            <Button onClick={onClose}>{formProps.cancelText ?? "取消"}</Button>
            <Button
              type="primary"
              loading={formProps.submitting}
              onClick={() => formRef.current?.submit()}
            >
              {formProps.submitText ?? (formProps.mode === "add" ? "创建" : "保存")}
            </Button>
          </Space>
        ) : null
      }
      title={title}
      open={open}
      width={width}
      styles={{ body: { maxHeight: "calc(100vh - 220px)", overflowY: "auto" } }}
      onCancel={onClose}
    >
      <SchemaForm ref={formRef} {...formProps} />
    </Modal>
  );
}

/** 抽屉形态的表单。 */
export function DrawerSchemaForm({
  open,
  title,
  width = 680,
  onClose,
  ...formProps
}: OverlayProps) {
  const formRef = useRef<SchemaFormRef>(null);
  const editable = formProps.mode !== "detail" && Boolean(formProps.onSubmit);
  return (
    <Drawer
      destroyOnHidden
      footer={
        editable ? (
          <Space>
            <Button onClick={onClose}>{formProps.cancelText ?? "取消"}</Button>
            <Button
              type="primary"
              loading={formProps.submitting}
              onClick={() => formRef.current?.submit()}
            >
              {formProps.submitText ?? (formProps.mode === "add" ? "创建" : "保存")}
            </Button>
          </Space>
        ) : null
      }
      title={title}
      open={open}
      size={width}
      styles={{ body: { maxHeight: "calc(100vh - 120px)", overflowY: "auto" } }}
      onClose={onClose}
    >
      <SchemaForm ref={formRef} {...formProps} />
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
