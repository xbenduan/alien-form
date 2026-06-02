import type React from 'react';
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  type FormConfig,
  type FormInstance,
  type IFormSchema,
} from '@alien-form/react';
import { Spin } from 'antd';
import * as adapters from '../adapters';
import { FormActions } from './form-actions';

export const recordFormComponents = {
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
  FormatValue: adapters.FormatValue,
  FormActions,
};

export const recordFormDecorators = {
  FormItem: adapters.FormItem,
};

interface SchemaFormSceneProps {
  schema: IFormSchema;
  initialValues?: FormConfig['initialValues'];
  components?: Record<string, any>;
  decorators?: Record<string, any>;
  handlers?: FormConfig['handlers'];
  scope?: FormConfig['scope'];
  validateFirst?: FormConfig['validateFirst'];
  onError?: FormConfig['onError'];
  loading?: boolean;
  className?: string;
  contentClassName?: string;
  shell?: (args: { form: FormInstance; content: React.ReactNode }) => React.ReactNode;
  children?: React.ReactNode | ((form: FormInstance) => React.ReactNode);
}

export function SchemaFormScene({
  schema,
  initialValues,
  components = recordFormComponents,
  decorators = recordFormDecorators,
  handlers,
  scope,
  validateFirst,
  onError,
  loading,
  className,
  contentClassName,
  shell,
  children,
}: SchemaFormSceneProps) {
  const form = useCreateForm({
    schema,
    initialValues,
    handlers,
    scope,
    validateFirst,
    onError,
  });

  const extraContent = typeof children === 'function' ? children(form) : children;

  const content = (
    <Spin spinning={Boolean(loading)}>
      <FormProvider form={form} components={components as never} decorators={decorators as never}>
        <div className={contentClassName}>
          <SchemaField />
          {extraContent}
        </div>
      </FormProvider>
    </Spin>
  );

  return <div className={className}>{shell ? shell({ form, content }) : content}</div>;
}
