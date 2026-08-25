import { App } from "antd";
import { SchemaForm } from "../../../components/SchemaForm";
import type { IFormSchema } from "@alien-form/core"; import type { SchemaRecord } from "../../../types/shared";
import type { SchemaFormRef } from "../../../components/SchemaForm";
import type { Ref } from "react";
import type { ModelRecord } from "../../../runtime/types";
import type { RecordActionMode } from "../types";

interface RecordActionFormProps {
  mode: Exclude<RecordActionMode, "closed">;
  /** 已编译的 form 场景 schema。 */
  formSchema: IFormSchema;
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
  formSchema,
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
      formSchema={formSchema}
      dataSource={record}
      formKey={formKey}
      submitting={submitting}
      onSubmit={mode === "detail" ? undefined : handleSubmit}
    />
  );
}
