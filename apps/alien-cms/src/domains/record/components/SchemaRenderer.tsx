import type { CmsModelSchema } from '../types/record';
import { SchemaFormBody } from '../../../shared/components/SchemaFormShared';

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
  layout = 'overlay',
}: SchemaFormViewProps) {
  const layoutClassName =
    layout === 'page' ? 'schema-form-layout schema-form-layout-page' : 'schema-form-layout';

  return (
    <div className={layoutClassName}>
      <SchemaFormBody
        mode="add"
        schema={schema}
        initialValues={initialValues}
        onFormReady={() => {}}
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
  return (
    <SchemaFormBody
      mode="detail"
      schema={schema}
      initialValues={initialValues}
      onFormReady={() => {}}
    />
  );
}
