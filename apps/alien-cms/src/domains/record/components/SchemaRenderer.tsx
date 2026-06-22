import { useCreateForm } from "@alien-form/react";
import {
  getSchemaFormBodyKey,
  SchemaFormBody,
} from "../../../shared/schema-form-scene";
import { createRecordFormConfig } from "../../../shared/utils/create-record-form-config";
import type { CmsModelSchema } from "../types/record";

interface SchemaFormViewProps {
  schema: CmsModelSchema;
  initialValues?: Record<string, unknown>;
  loading?: boolean;
  layout?: 'overlay' | 'page';
  hideActions?: boolean;
  submitText?: string;
  submitButtonProps?: unknown;
  onSubmit?: (values: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
}

export function SchemaFormView({
  schema,
  initialValues,
  layout = "overlay",
}: SchemaFormViewProps) {
  const layoutClassName =
    layout === "page" ? "schema-form-layout schema-form-layout-page" : "schema-form-layout";
  const form = useCreateForm(
    createRecordFormConfig({
      schema,
      initialValues,
    }),
    [getSchemaFormBodyKey("add", initialValues), schema],
  );

  return (
    <div className={layoutClassName}>
      <SchemaFormBody mode="add" form={form} />
    </div>
  );
}

export function DetailSchemaView({
  schema,
  initialValues,
}: {
  schema: CmsModelSchema;
  initialValues?: Record<string, unknown>;
}) {
  const form = useCreateForm(
    createRecordFormConfig({
      schema,
      initialValues,
    }),
    [getSchemaFormBodyKey("detail", initialValues), schema],
  );

  return <SchemaFormBody mode="detail" form={form} />;
}
