import type { ButtonProps } from 'antd';
import { message } from 'antd';
import type { CmsModelSchema } from '../types/record';
import { RecordActionFormScene } from './RecordActionFormScene';
import {
  detailFormComponents,
  recordFormComponents,
  recordFormDecorators,
} from '../../../shared/adapters';
import {
  FormActionContext,
  FormActions,
  type FormActionContextValue,
} from '../../../shared/ui';

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
  const actionsCtx: FormActionContextValue | null = hideActions
    ? null
    : {
        kind: 'submit',
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
            message.warning(messages[0]);
            return;
          }
          message.warning('请先修正表单校验错误');
        },
      };

  return (
    <div className={layoutClassName}>
      <FormActionContext.Provider value={actionsCtx}>
        <RecordActionFormScene
          schema={schema}
          initialValues={initialValues}
          components={recordFormComponents}
          decorators={recordFormDecorators}
          loading={loading}
          contentClassName="schema-form-content"
          footer={(form) => (
            hideActions
              ? null
              : (
                  <div className="schema-form-footer-actions">
                    <FormActions form={form} />
                  </div>
                )
          )}
        />
      </FormActionContext.Provider>
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
    <RecordActionFormScene
      schema={schema}
      initialValues={initialValues}
      components={detailFormComponents}
      decorators={recordFormDecorators}
      contentClassName="schema-form-content"
    />
  );
}
