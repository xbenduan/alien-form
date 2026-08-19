import { App } from "antd";
import { SchemaForm } from "@alien-form/shared";
import type { SchemaRecord } from "@alien-form/shared";
import type { SchemaFormRef } from "@alien-form/shared";
import type { Ref } from "react";
import { handles } from "../../../handles";
import type { ModelRecord, ModelSchema } from "../../../services";
import type { RecordActionMode } from "../types";

interface RecordActionFormProps {
  mode: Exclude<RecordActionMode, "closed">;
  schema: ModelSchema;
  record?: ModelRecord;
  formKey: string;
  submitting?: boolean;
  onSubmitted: () => void;
  createRecord: (values: Record<string, unknown>) => Promise<unknown>;
  updateRecord: (id: string, values: Record<string, unknown>) => Promise<unknown>;
  formRef?: Ref<SchemaFormRef>;
}

/**
 * 记录动作表单：add / edit / detail 共用同一份 SchemaForm。
 * 路由页面与叠加层（drawer/modal）都复用它，只是外层容器不同。
 */
export function RecordActionForm({
  mode,
  schema,
  record,
  formKey,
  submitting,
  onSubmitted,
  createRecord,
  updateRecord,
  formRef,
}: RecordActionFormProps) {
  const { message } = App.useApp();

  const handleSubmit = async (values: SchemaRecord) => {
    if (mode === "add") {
      await createRecord(values);
      message.success("新增成功");
    } else {
      await updateRecord(String(record?.id), values);
      message.success("保存成功");
    }
    onSubmitted();
  };

  return (
    <SchemaForm
      ref={formRef}
      mode={mode}
      schema={schema}
      dataSource={record}
      handlers={handles}
      formKey={formKey}
      submitting={submitting}
      onSubmit={mode === "detail" ? undefined : handleSubmit}
    />
  );
}
