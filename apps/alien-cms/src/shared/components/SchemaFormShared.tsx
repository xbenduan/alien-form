import { FormProvider, SchemaField, type FormInstance } from "@alien-form/react";
import { Alert, Empty, Spin, message } from "antd";
import { detailFormComponents, recordFormComponents, recordFormDecorators } from "../adapters";
import { createRecordFormConfig } from "../utils/create-record-form-config";
import type {
  CmsModelSchema,
  ModelActionMode,
  ModelRecord,
} from "../../domains/record/types/record";

export type SchemaFormMode = Exclude<ModelActionMode, "closed">;

export function getSchemaFormAdapters(mode: SchemaFormMode) {
  return mode === "detail" ? detailFormComponents : recordFormComponents;
}

export function getSchemaFormSubmitText(mode: "add" | "edit") {
  return mode === "add" ? "创建记录" : "保存修改";
}

function normalizeSubmitErrorMessage(messageText: string) {
  return /is required$/i.test(messageText.trim()) ? "该字段为必填项" : messageText;
}

function parseSubmitErrorDetails(error: unknown) {
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

function applySubmitFieldErrors(
  form: FormInstance,
  fieldErrors: Array<{ field: string; message: string }>,
) {
  if (fieldErrors.length === 0) {
    return;
  }

  for (const item of fieldErrors) {
    form.field(item.field)?.setErrors([{ message: item.message, type: "server" }]);
  }
}

export function handleSchemaFormSubmitError(form: FormInstance, error: unknown) {
  const { messages, fieldErrors } = parseSubmitErrorDetails(error);
  applySubmitFieldErrors(form, fieldErrors);
  if (messages?.length) {
    message.warning(messages[0]);
    return;
  }
  message.warning("请先修正表单校验错误");
}

export async function submitSchemaForm(
  form: FormInstance,
  onSubmit: (values: Record<string, unknown>) => Promise<void>,
) {
  const isValid = await form.validate();
  if (!isValid) {
    const error: Error & { messages?: string[] } = new Error("Validation failed");
    error.messages = form.errors().map((item) => item.message);
    throw error;
  }

  await onSubmit(form.values());
}

type SchemaFormInitialValues = Record<string, unknown> | ModelRecord;

export function getSchemaFormBodyKey(
  mode: SchemaFormMode,
  initialValues?: SchemaFormInitialValues,
) {
  const recordId = "id" in (initialValues ?? {}) ? initialValues?.id : undefined;
  const updatedAt = "updatedAt" in (initialValues ?? {}) ? initialValues?.updatedAt : undefined;
  return `${mode}:${recordId ?? "new"}:${updatedAt ?? 0}`;
}

export function renderPendingSchemaFormBody(
  mode: SchemaFormMode,
  loading?: boolean,
  initialValues?: SchemaFormInitialValues,
) {
  if (mode === "detail") {
    if (loading) {
      return <Spin className="drawer-loading" />;
    }
    if (!initialValues) {
      return <Empty description="暂无详情数据" />;
    }
  }

  if (mode === "edit") {
    if (loading) {
      return <Spin className="drawer-loading" />;
    }
    if (!initialValues) {
      return <Alert type="warning" showIcon title="记录不存在或加载失败" />;
    }
  }

  return null;
}

interface SchemaFormBodyProps {
  mode: SchemaFormMode;
  form: FormInstance;
}

export function SchemaFormBody({ mode, form }: SchemaFormBodyProps) {
  return (
    <FormProvider
      form={form}
      components={getSchemaFormAdapters(mode) as never}
      decorators={recordFormDecorators as never}
    >
      <div className="schema-form-content">
        <SchemaField />
      </div>
    </FormProvider>
  );
}
