import type { FormInstance } from "@alien-form/react";
import { Button, Drawer, Space } from "antd";
import { useRef, type FC } from "react";
import type { CmsModelSchema, ModelActionMode, ModelRecord } from "../../domains/record/types/record";
import {
  getSchemaFormBodyKey,
  getSchemaFormSubmitText,
  handleSchemaFormSubmitError,
  renderPendingSchemaFormBody,
  SchemaFormBody,
} from "./SchemaFormShared";

interface DrawerSchemaFormProps {
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

const DrawerSchemaForm: FC<DrawerSchemaFormProps> = ({
  open,
  title,
  width = 680,
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

  const footer = mode === "detail" || !canRenderForm
    ? null
    : (
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
      );

  return (
    <Drawer
      destroyOnHidden
      title={title}
      open={open}
      width={width}
      footer={footer}
      onClose={onClose}
    >
      {canRenderForm ? (
        <SchemaFormBody
          key={getSchemaFormBodyKey(mode, initialValues)}
          mode={mode}
          schema={schema}
          initialValues={initialValues}
          formRef={formRef}
        />
      ) : renderPendingSchemaFormBody(mode, loading, initialValues)}
    </Drawer>
  );
};

export default DrawerSchemaForm;
