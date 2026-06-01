import { FormProvider, SchemaField, useCreateForm } from '@alien-form/react';
import type { ButtonProps } from 'antd';
import { Button, Space, message } from 'antd';
import { schemaHandlers } from '../../app/schema-handlers';
import * as adapters from '../../adapters';
import type { CmsModelSchema } from '../../types/model';

export const schemaComponents = {
  Input: adapters.Input,
  Textarea: adapters.Textarea,
  NumberInput: adapters.NumberInput,
  Select: adapters.Select,
  Switch: adapters.Switch,
  DateInput: adapters.DateInput,
  Radio: adapters.Radio,
  CheckboxGroup: adapters.CheckboxGroup,
  Rate: adapters.Rate,
  ArrayCards: adapters.ArrayCards,
  SectionCard: adapters.SectionCard,
  TagsInput: adapters.TagsInput,
  SkuTable: adapters.SkuTable,
  DetailText: adapters.DetailText,
  DetailBoolean: adapters.DetailBoolean,
  DetailDate: adapters.DetailDate,
  DetailDateTime: adapters.DetailDateTime,
  DetailStatus: adapters.DetailStatus,
  DetailArrayText: adapters.DetailArrayText,
  DetailSection: adapters.DetailSection,
};

export const schemaDecorators = {
  FormItem: adapters.FormItem,
};

interface SchemaFormViewProps {
  schema: CmsModelSchema;
  initialValues?: Record<string, unknown>;
  submitText: string;
  submitButtonProps?: ButtonProps;
  loading?: boolean;
  layout?: 'overlay' | 'page';
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
  onSubmit,
  onCancel,
}: SchemaFormViewProps) {
  const form = useCreateForm({ schema, initialValues, handlers: schemaHandlers });
  const layoutClassName =
    layout === 'page' ? 'schema-form-layout schema-form-layout-page' : 'schema-form-layout';
  const [messageApi, messageContextHolder] = message.useMessage();

  const handleSubmit = async () => {
    const isValid = await form.validate();
    if (!isValid) {
      messageApi.warning('请先修正表单校验错误');
      return;
    }

    await onSubmit(form.values());
  };

  return (
    <div className={layoutClassName}>
      {messageContextHolder}
      <FormProvider
        form={form}
        components={schemaComponents as Record<string, any>}
        decorators={schemaDecorators as Record<string, any>}
      >
        <SchemaField />
      </FormProvider>
      <div className="schema-form-footer-actions">
        <Space>
          <Button onClick={() => form.reset()}>重置</Button>
          <Button onClick={onCancel}>取消</Button>
          <Button
            type="primary"
            loading={loading}
            {...submitButtonProps}
            onClick={handleSubmit}
          >
            {submitText}
          </Button>
        </Space>
      </div>
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
  const form = useCreateForm({ schema, initialValues, handlers: schemaHandlers });

  return (
    <FormProvider
      form={form}
      components={schemaComponents as Record<string, any>}
      decorators={schemaDecorators as Record<string, any>}
    >
      <SchemaField />
    </FormProvider>
  );
}
