import type { FormConfig } from '@alien-form/react';
import { message } from 'antd';
import type { CmsModelSchema } from '../types/record';
import { recordSchemaHandlers } from '../schema-handlers';

interface CreateRecordFormConfigOptions {
  schema: CmsModelSchema;
  initialValues?: Record<string, unknown>;
}

export function createRecordFormConfig({
  schema,
  initialValues,
}: CreateRecordFormConfigOptions): FormConfig {
  return {
    schema,
    initialValues,
    handlers: recordSchemaHandlers,
    onError: (error) => {
      if (error.scope === 'x-validate' || error.scope === 'expression') {
        return;
      }
      message.warning(error.message);
    },
  };
}
