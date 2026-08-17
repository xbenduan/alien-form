import type { IFormSchema } from "@alien-form/core";
import type { FormConfig } from "@alien-form/react";
import type { MessageInstance } from "antd/es/message/interface";

export interface CreateFormConfigOptions {
  schema: IFormSchema;
  initialValues?: Record<string, unknown>;
  handlers?: FormConfig["handlers"];
  onError?: FormConfig["onError"];
  messageApi: MessageInstance;
}

export function createFormConfig({
  schema,
  initialValues,
  handlers,
  onError,
  messageApi,
}: CreateFormConfigOptions): FormConfig {
  return {
    schema,
    initialValues,
    handlers,
    onError:
      onError ??
      ((error) => {
        if (error.scope === "x-validate" || error.scope === "expression") {
          return;
        }
        messageApi.warning(error.message);
      }),
  };
}
