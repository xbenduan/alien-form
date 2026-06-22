import { useCreateForm } from "@alien-form/react";
import { Button, Space } from "antd";
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
} from "../schema-form-scene";
import { createRecordFormConfig } from "../utils/create-record-form-config";

interface PageSchemaFormProps {
  mode: Exclude<ModelActionMode, "closed">;
  schema: CmsModelSchema;
  initialValues?: ModelRecord;
  loading?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmitAdd: (values: Record<string, unknown>) => Promise<void>;
  onSubmitEdit: (values: Record<string, unknown>) => Promise<void>;
}

const PageSchemaForm: FC<PageSchemaFormProps> = ({
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

  return (
    <div className="schema-form-layout schema-form-layout-page">
      {canRenderForm ? (
        <SchemaFormBody mode={mode} form={form} />
      ) : (
        renderPendingSchemaFormBody(mode, loading, initialValues)
      )}
      {mode === "detail" || !canRenderForm ? null : (
        <div className="schema-form-footer-actions">
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
        </div>
      )}
    </div>
  );
};

export default PageSchemaForm;
