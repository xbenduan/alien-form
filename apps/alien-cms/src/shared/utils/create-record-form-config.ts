import type { FormConfig } from '@alien-form/react';
import { message } from "../ui";
import { map as recordSchemaHandlers } from '../handlers/index.ts';
import type { CmsModelSchema } from '../../domains/record/types/record';

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
