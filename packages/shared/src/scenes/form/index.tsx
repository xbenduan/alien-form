import React from "react";
import { FormProvider, SchemaField, type FormInstance } from "@alien-form/react";
import { Alert, Empty, Spin } from "antd";
import type { MessageInstance } from "antd/es/message/interface";
import * as adapters from "../../adapters";
import { buildRenderableScenes } from "../../build-renderable-scenes";
import type { SchemaFormMode, SchemaRecord } from "../../types";
import { FormItem } from "./item";

export const formComponents = buildRenderableScenes(adapters, "form");
const detailComponents = buildRenderableScenes(adapters, "detail");
export const formDecorators = { FormItem } as const;

export function getFormComponents(mode: SchemaFormMode) {
  return mode === "detail" ? detailComponents : formComponents;
}

export function getFormDecorators() {
  return formDecorators;
}

export function renderPendingForm(
  mode: SchemaFormMode,
  loading?: boolean,
  initialValues?: SchemaRecord,
) {
  if (mode === "detail") {
    if (loading) return <Spin className="schema-form-loading" />;
    if (!initialValues) return <Empty description="暂无详情数据" />;
  }

  if (mode === "edit") {
    if (loading) return <Spin className="schema-form-loading" />;
    if (!initialValues) {
      return <Alert type="warning" showIcon title="记录不存在或加载失败" />;
    }
  }

  return null;
}

export function FormScene({ mode, form }: { mode: SchemaFormMode; form: FormInstance }) {
  return (
    <FormProvider
      form={form}
      components={getFormComponents(mode) as never}
      decorators={getFormDecorators() as never}
    >
      <SchemaField />
    </FormProvider>
  );
}

export function getFormSubmitText(mode: Exclude<SchemaFormMode, "detail">) {
  return mode === "add" ? "创建记录" : "保存修改";
}

function normalizeSubmitErrorMessage(messageText: string) {
  return /is required$/i.test(messageText.trim()) ? "该字段为必填项" : messageText;
}

export function parseSubmitError(error: unknown) {
  const messages =
    error && typeof error === "object" && "messages" in error
      ? (error as { messages?: string[] }).messages
      : undefined;
  if (messages?.length) {
    return {
      messages,
      fieldErrors: [] as Array<{ field: string; message: string }>,
    };
  }

  if (!(error instanceof Error)) {
    return {
      messages: undefined,
      fieldErrors: [] as Array<{ field: string; message: string }>,
    };
  }

  const payloadText = error.message.match(/^HTTP\s+\d+:\s*(\{.*\})$/s)?.[1];
  if (!payloadText) {
    return {
      messages: undefined,
      fieldErrors: [] as Array<{ field: string; message: string }>,
    };
  }

  try {
    const payload = JSON.parse(payloadText) as {
      details?: Array<{ field?: string; message?: string }>;
    };
    const fieldErrors = (payload.details ?? [])
      .filter(
        (item): item is { field: string; message: string } =>
          typeof item.field === "string" && typeof item.message === "string",
      )
      .map((item) => ({
        field: item.field,
        message: normalizeSubmitErrorMessage(item.message),
      }));
    return {
      messages: fieldErrors.map((item) => item.message),
      fieldErrors,
    };
  } catch {
    return {
      messages: undefined,
      fieldErrors: [] as Array<{ field: string; message: string }>,
    };
  }
}

export function handleFormSubmitError(
  form: FormInstance,
  error: unknown,
  messageApi: MessageInstance,
) {
  const { messages, fieldErrors } = parseSubmitError(error);
  for (const item of fieldErrors) {
    form.field(item.field)?.setErrors([{ message: item.message, type: "server" }]);
  }

  messageApi.warning(messages?.[0] ?? "请先修正表单校验错误");
}

export async function submitForm(
  form: FormInstance,
  onSubmit: (values: SchemaRecord) => void | Promise<void>,
) {
  const isValid = await form.validate();
  if (!isValid) {
    const error: Error & { messages?: string[] } = new Error("Validation failed");
    error.messages = form.errors().map((item) => item.message);
    throw error;
  }

  await onSubmit(form.values());
}
