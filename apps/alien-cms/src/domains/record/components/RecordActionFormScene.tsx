import type React from 'react';
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  type FormInstance,
} from '@alien-form/react';
import { Spin } from 'antd';
import { createRecordFormConfig } from './create-record-form-config';
import type { CmsModelSchema } from '../types/record';

interface RecordActionFormSceneProps {
  schema: CmsModelSchema;
  initialValues?: Record<string, unknown>;
  components: Record<string, unknown>;
  decorators: Record<string, unknown>;
  loading?: boolean;
  className?: string;
  contentClassName?: string;
  footer?: (form: FormInstance) => React.ReactNode;
  children?: React.ReactNode;
}

export function RecordActionFormScene({
  schema,
  initialValues,
  components,
  decorators,
  loading,
  className,
  contentClassName,
  footer,
  children,
}: RecordActionFormSceneProps) {
  const form = useCreateForm(createRecordFormConfig({
    schema,
    initialValues,
  }));

  return (
    <div className={className}>
      <Spin spinning={Boolean(loading)}>
        <FormProvider form={form} components={components as never} decorators={decorators as never}>
          <div className={contentClassName}>
            <SchemaField />
            {children}
          </div>
        </FormProvider>
      </Spin>
      {footer ? footer(form) : null}
    </div>
  );
}
