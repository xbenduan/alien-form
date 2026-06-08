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
  return mode === "add" ? "创建记录" : "保存修改";
}

export function handleSchemaFormSubmitError(error: unknown) {
  const messages = error && typeof error === "object" && "messages" in error
    ? (error as { messages?: string[] }).messages
    : undefined;
  if (messages?.length) {
    message.warning(messages[0]);
    return;
  }
  message.warning("请先修正表单校验错误");
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
      return <Empty description="暂无详情数据" />;
    }
  }

  if (mode === "edit") {
    if (loading) {
      return <Spin className="drawer-loading" />;
    }
    if (!initialValues) {
      return <Alert type="warning" showIcon message="记录不存在或加载失败" />;
    }
  }

  return null;
}

interface SchemaFormBodyProps {
  mode: SchemaFormMode;
  schema: CmsModelSchema;
  initialValues?: SchemaFormInitialValues;
  onFormReady: (form: FormInstance) => void;
}

export function SchemaFormBody({
  mode,
  schema,
  initialValues,
  onFormReady,
}: SchemaFormBodyProps) {
  const form = useCreateForm(createRecordFormConfig({
    schema,
    initialValues,
  }));

  useEffect(() => {
    onFormReady(form);
  }, [form, onFormReady]);

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
