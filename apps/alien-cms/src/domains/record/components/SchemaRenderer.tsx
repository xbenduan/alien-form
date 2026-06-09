import type { FormInstance } from "@alien-form/react";
import { useRef } from "react";
import { SchemaFormBody } from "../../../shared/components/SchemaFormShared";
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
  const formRef = useRef<FormInstance | null>(null);
  const layoutClassName =
    layout === "page" ? "schema-form-layout schema-form-layout-page" : "schema-form-layout";

  return (
    <div className={layoutClassName}>
      <SchemaFormBody
        mode="add"
        schema={schema}
        initialValues={initialValues}
        formRef={formRef}
      />
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
  const formRef = useRef<FormInstance | null>(null);

  return (
    <SchemaFormBody
      mode="detail"
      schema={schema}
      initialValues={initialValues}
      formRef={formRef}
    />
  );
}
