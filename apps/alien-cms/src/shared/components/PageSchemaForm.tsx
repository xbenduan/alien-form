import type { FormInstance } from "@alien-form/react";
import { Button, Space } from "antd";
import { useRef, type FC } from "react";
import type { CmsModelSchema, ModelActionMode, ModelRecord } from "../../domains/record/types/record";
import {
  getSchemaFormBodyKey,
  getSchemaFormSubmitText,
  handleSchemaFormSubmitError,
  renderPendingSchemaFormBody,
  SchemaFormBody,
} from "./SchemaFormShared";

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
  const formRef = useRef<FormInstance | null>(null);
  const canRenderForm = mode === "add" || Boolean(initialValues);

  return (
    <div className="schema-form-layout schema-form-layout-page">
      {canRenderForm ? (
        <SchemaFormBody
          key={getSchemaFormBodyKey(mode, initialValues)}
          mode={mode}
          schema={schema}
          initialValues={initialValues}
          formRef={formRef}
        />
      ) : renderPendingSchemaFormBody(mode, loading, initialValues)}
      {mode === "detail" || !canRenderForm ? null : (
        <div className="schema-form-footer-actions">
          <Space size={8}>
            <Button onClick={onClose}>\u53d6\u6d88</Button>
            <Button
              type="primary"
              loading={submitting}
              onClick={() => {
                const form = formRef.current;
                if (!form) {
                  return;
                }
                void form
                  .submit(async (values) => {
                    if (mode === "add") {
                      await onSubmitAdd(values);
                      return;
                    }
                    await onSubmitEdit(values);
                  })
                  .catch(handleSchemaFormSubmitError);
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
