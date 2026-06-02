import type { CmsModelSchema } from '@alien-form/cms';
import type { ButtonProps } from 'antd';
import { message } from 'antd';
import { recordSchemaHandlers } from '../schema-handlers';
import { FormActionContext, SchemaFormScene } from '../../../shared/form-renderer';

interface SchemaFormViewProps {
  schema: CmsModelSchema;
  initialValues?: Record<string, unknown>;
  submitText: string;
  submitButtonProps?: ButtonProps;
  loading?: boolean;
  layout?: 'overlay' | 'page';
  hideActions?: boolean;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

export function SchemaFormView({
  schema,
  initialValues,
  submitText,
  submitButtonProps,
  loading,
  layout = 'overlay',
  hideActions,
  onSubmit,
  onCancel,
}: SchemaFormViewProps) {
  const layoutClassName =
    layout === 'page' ? 'schema-form-layout schema-form-layout-page' : 'schema-form-layout';
  const [messageApi, messageContextHolder] = message.useMessage();
  const actionsCtx = hideActions
    ? null
    : {
        kind: 'submit' as const,
        loading,
        submitText,
        submitButtonProps,
        showReset: false,
        showCancel: true,
        onCancel,
        onSubmit,
        onSubmitError: (error: unknown) => {
          const messages = error && typeof error === 'object' && 'messages' in error
            ? (error as { messages?: string[] }).messages
            : undefined;
          if (messages?.length) {
            messageApi.warning(messages[0]);
            return;
          }
          messageApi.warning('请先修正表单校验错误');
        },
      };

  return (
    <div className={layoutClassName}>
      {messageContextHolder}
      <FormActionContext.Provider value={actionsCtx}>
        <SchemaFormScene
          schema={schema}
          initialValues={initialValues}
          handlers={recordSchemaHandlers}
          loading={loading}
          onError={(error) => {
            if (error.scope === 'x-validate' || error.scope === 'expression') {
              return;
            }
            messageApi.warning(error.message);
          }}
        />
      </FormActionContext.Provider>
    </div>
  );
}

export const DrawerSchemaForm = SchemaFormView;

export function DetailSchemaView({
  schema,
  initialValues,
}: {
  schema: CmsModelSchema;
  initialValues?: Record<string, unknown>;
}) {
  return (
    <SchemaFormScene
      schema={schema}
      initialValues={initialValues}
      handlers={recordSchemaHandlers}
    />
  );
}
