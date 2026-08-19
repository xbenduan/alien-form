import { useCreateForm, FormProvider, SchemaField } from "@alien-form/react";
import type { FormInstance, IFormSchema } from "@alien-form/react";
import { useEffect } from "react";
import type { FieldMode, SchemaHandlers, SchemaRecord } from "../types";
import { FieldModeScope } from "./field-mode";
import { fieldComponents, fieldDecorators } from "./registry";

export interface SchemaRendererProps {
  mode: FieldMode;
  schema: IFormSchema;
  initialValues?: SchemaRecord;
  handlers?: SchemaHandlers;
  /** 重建 key：mode / schema / 记录 id 变化时重建 form 实例。 */
  formKey?: string | number;
  onFormReady?: (form: FormInstance) => void;
}

/**
 * 协议渲染核心：把一份 form schema 交给 @alien-form/react 渲染。
 * SchemaForm（可编辑 + 提交）与 FieldDetailModal（只读详情）都复用它。
 */
export function SchemaRenderer({
  mode,
  schema,
  initialValues,
  handlers,
  formKey,
  onFormReady,
}: SchemaRendererProps) {
  const form = useCreateForm({ schema, initialValues, handlers }, [mode, schema, formKey]);
  useEffect(() => {
    onFormReady?.(form);
  }, [form, onFormReady]);

  return (
    <FieldModeScope value={mode}>
      <FormProvider
        form={form}
        components={fieldComponents as never}
        decorators={fieldDecorators as never}
      >
        <SchemaField />
      </FormProvider>
    </FieldModeScope>
  );
}
