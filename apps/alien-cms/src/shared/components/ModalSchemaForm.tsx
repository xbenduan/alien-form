import { useCreateForm } from "@alien-form/react";
import { Button, Modal, Space } from "antd";
import type { FC } from "react";
import type {
  CmsModelSchema,
  ModelActionMode,
  ModelRecord,
} from "../../domains/record/types/record";
import {
  getSchemaFormBodyKey,
  getSchemaFormSubmitText,
  handleSchemaFormSubmitError,
  renderPendingSchemaFormBody,
  SchemaFormBody,
  submitSchemaForm,
} from "./SchemaFormShared";
import { createRecordFormConfig } from "../utils/create-record-form-config";

interface ModalSchemaFormProps {
  open: boolean;
  title: string;
  width?: number;
  mode: Exclude<ModelActionMode, "closed">;
  schema: CmsModelSchema;
  initialValues?: ModelRecord;
  loading?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmitAdd: (values: Record<string, unknown>) => Promise<void>;
  onSubmitEdit: (values: Record<string, unknown>) => Promise<void>;
}

const ModalSchemaForm: FC<ModalSchemaFormProps> = ({
  open,
  title,
  width = 720,
  mode,
  schema,
  initialValues,
  loading,
  submitting,
  onClose,
  onSubmitAdd,
  onSubmitEdit,
}) => {
  const canRenderForm = mode === "add" || Boolean(initialValues);
  const formKey = getSchemaFormBodyKey(mode, initialValues);
  const form = useCreateForm(
    createRecordFormConfig({
      schema,
      initialValues,
    }),
    [formKey, schema],
  );

  const footer =
    mode === "detail" || !canRenderForm ? null : (
      <Space size={8}>
        <Button onClick={onClose}>取消</Button>
        <Button
          type="primary"
          loading={submitting}
          onClick={() => {
            void submitSchemaForm(form, async (values) => {
                if (mode === "add") {
                  await onSubmitAdd(values);
                  return;
                }
                await onSubmitEdit(values);
              })
              .catch((error) => handleSchemaFormSubmitError(form, error));
          }}
        >
          {getSchemaFormSubmitText(mode)}
        </Button>
      </Space>
    );

  return (
    <Modal
      centered
      destroyOnHidden
      footer={footer}
      title={title}
      open={open}
      width={width}
      onCancel={onClose}
      maskClosable={false}
    >
      {canRenderForm ? (
        <SchemaFormBody mode={mode} form={form} />
      ) : (
        renderPendingSchemaFormBody(mode, loading, initialValues)
      )}
    </Modal>
  );
};

export default ModalSchemaForm;
