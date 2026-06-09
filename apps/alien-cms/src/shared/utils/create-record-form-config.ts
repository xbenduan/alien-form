import type { FormConfig } from '@alien-form/react';
import { message } from 'antd';
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
      // #region debug-point B:form-on-error
      fetch("http://127.0.0.1:7777/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "required-field-rollback",
          runId: "pre-fix",
          hypothesisId: "B",
          location: "create-record-form-config.ts:onError",
          msg: "[DEBUG] form onError triggered",
          data: {
            scope: error.scope,
            path: error.path,
            key: error.key,
            message: error.message,
          },
          ts: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      if (error.scope === 'x-validate' || error.scope === 'expression') {
        return;
      }
      message.warning(error.message);
    },
  };
}
