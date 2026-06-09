import { FormProvider, SchemaField, useCreateForm, type FormInstance } from "@alien-form/react";
import { Alert, Empty, Spin, message } from "antd";
import { useEffect } from "react";
import { detailFormComponents, recordFormComponents, recordFormDecorators } from "../adapters";
import { createRecordFormConfig } from "../utils/create-record-form-config";
import type { CmsModelSchema, ModelActionMode, ModelRecord } from "../../domains/record/types/record";

export type SchemaFormMode = Exclude<ModelActionMode, "closed">;

export function getSchemaFormAdapters(mode: SchemaFormMode) {
  return mode === "detail" ? detailFormComponents : recordFormComponents;
}

export function getSchemaFormSubmitText(mode: "add" | "edit") {
  return mode === "add" ? "\u521b\u5efa\u8bb0\u5f55" : "\u4fdd\u5b58\u4fee\u6539";
}

export function handleSchemaFormSubmitError(error: unknown) {
  const messages = error && typeof error === "object" && "messages" in error
    ? (error as { messages?: string[] }).messages
    : undefined;
  if (messages?.length) {
    message.warning(messages[0]);
    return;
  }
  message.warning("\u8bf7\u5148\u4fee\u6b63\u8868\u5355\u6821\u9a8c\u9519\u8bef");
}

type SchemaFormInitialValues = Record<string, unknown> | ModelRecord;

export function getSchemaFormBodyKey(mode: SchemaFormMode, initialValues?: SchemaFormInitialValues) {
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
      return <Empty description="\u6682\u65e0\u8be6\u60c5\u6570\u636e" />;
    }
  }

  if (mode === "edit") {
    if (loading) {
      return <Spin className="drawer-loading" />;
    }
    if (!initialValues) {
      return <Alert type="warning" showIcon message="\u8bb0\u5f55\u4e0d\u5b58\u5728\u6216\u52a0\u8f7d\u5931\u8d25" />;
    }
  }

  return null;
}

interface SchemaFormBodyProps {
  mode: SchemaFormMode;
  schema: CmsModelSchema;
  initialValues?: SchemaFormInitialValues;
  formRef: React.MutableRefObject<FormInstance | null>;
}

export function SchemaFormBody({
  mode,
  schema,
  initialValues,
  formRef,
}: SchemaFormBodyProps) {
  const form = useCreateForm(createRecordFormConfig({
    schema,
    initialValues,
  }));

  useEffect(() => {
    formRef.current = form;
    return () => {
      formRef.current = null;
    };
  }, [form, formRef]);

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
