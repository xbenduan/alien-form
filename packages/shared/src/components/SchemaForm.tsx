import type { IFormSchema } from "@alien-form/core";
import { useCreateForm } from "@alien-form/react";
import { App, Button, Drawer, Modal, Space } from "antd";
import type { ReactNode } from "react";
import { createFormConfig } from "../create-form-config";
import {
  FormScene,
  getFormSubmitText,
  handleFormSubmitError,
  renderPendingForm,
  submitForm,
} from "../scenes/form";
import type { FormActions, SchemaFormMode, SchemaHandlers, SchemaRecord } from "../types";

export interface SchemaFormProps {
  mode: SchemaFormMode;
  schema: IFormSchema;
  formKey?: string | number;
  initialValues?: SchemaRecord;
  handlers?: SchemaHandlers;
  actions?: FormActions;
  loading?: boolean;
  submitting?: boolean;
  className?: string;
  footerClassName?: string;
}

export function SchemaForm({
  mode,
  schema,
  formKey,
  initialValues,
  handlers,
  actions,
  loading,
  submitting,
  className = "schema-form-layout",
  footerClassName = "schema-form-footer-actions",
}: SchemaFormProps) {
  const canRenderForm = mode === "add" || Boolean(initialValues);

  return (
    <div className={className}>
      {canRenderForm ? (
        <ActiveSchemaForm
          mode={mode}
          schema={schema}
          formKey={formKey}
          initialValues={initialValues}
          handlers={handlers}
          actions={actions}
          submitting={submitting}
          footerClassName={footerClassName}
        />
      ) : (
        renderPendingForm(mode, loading, initialValues)
      )}
    </div>
  );
}

function ActiveSchemaForm({
  mode,
  schema,
  formKey,
  initialValues,
  handlers,
  actions,
  submitting,
  footerClassName,
}: SchemaFormProps & { footerClassName: string }) {
  const { message: messageApi } = App.useApp();
  const form = useCreateForm(createFormConfig({ schema, initialValues, handlers, messageApi }), [
    mode,
    schema,
    formKey,
  ]);
  const editableMode = mode === "detail" ? undefined : mode;

  const handleSubmit = () => {
    if (!editableMode || !actions?.onSubmit) return;

    void submitForm(form, (values) => actions.onSubmit?.(values, editableMode)).catch(
      (error: unknown) => {
        handleFormSubmitError(form, error, messageApi);
        actions.onSubmitError?.(error);
      },
    );
  };

  return (
    <>
      <FormScene mode={mode} form={form} />
      {!editableMode || !actions ? null : (
        <div className={footerClassName}>
          <Space size={8}>
            {actions.onCancel ? (
              <Button onClick={actions.onCancel}>{actions.cancelText ?? "取消"}</Button>
            ) : null}
            {actions.onSubmit ? (
              <Button type="primary" loading={submitting} onClick={handleSubmit}>
                {actions.submitText ?? getFormSubmitText(editableMode)}
              </Button>
            ) : null}
          </Space>
        </div>
      )}
    </>
  );
}

interface OverlaySchemaFormProps extends SchemaFormProps {
  open: boolean;
  title: ReactNode;
  width?: number;
  onClose: () => void;
}

export function ModalSchemaForm({
  open,
  title,
  width = 720,
  onClose,
  ...formProps
}: OverlaySchemaFormProps) {
  return (
    <Modal
      centered
      destroyOnHidden
      footer={null}
      title={title}
      open={open}
      width={width}
      onCancel={onClose}
      mask={{ closable: false }}
    >
      <SchemaForm {...formProps} />
    </Modal>
  );
}

export function DrawerSchemaForm({
  open,
  title,
  width = 680,
  onClose,
  ...formProps
}: OverlaySchemaFormProps) {
  return (
    <Drawer
      destroyOnHidden
      title={title}
      open={open}
      size={width}
      footer={null}
      onClose={onClose}
      mask={{ closable: false }}
    >
      <SchemaForm {...formProps} />
    </Drawer>
  );
}

export function PageSchemaForm(props: SchemaFormProps) {
  return <SchemaForm {...props} className="schema-form-layout schema-form-layout-page" />;
}
