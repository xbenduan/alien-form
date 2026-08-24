import { useCreateForm, FormProvider, SchemaField } from "@alien-form/react";
import type { FormInstance, IFormSchema } from "@alien-form/react";
import { createContext, Suspense, useContext, useEffect, useRef } from "react";
import type { FieldMode, SchemaRecord } from "../types";
import { FieldModeScope } from "./field-mode";
import { fieldComponents, fieldDecorators } from "./registry";

export interface SchemaRendererProps {
  mode: FieldMode;
  schema: IFormSchema;
  initialValues?: SchemaRecord;
  /** 重建 key：mode / schema / 记录 id 变化时重建 form 实例。 */
  formKey?: string | number;
  /** schema 变化重建实例时保留旧表单值（Filter 使用）。 */
  preserveValuesOnRebuild?: boolean;
  onFormReady?: (form: FormInstance) => void;
}

export interface RuntimeResourceContextValue {
  components?: Record<string, unknown>;
  decorators?: Record<string, unknown>;
  handlers?: Record<string, unknown>;
  scope?: Record<string, unknown>;
}

export const RuntimeResourceContext = createContext<RuntimeResourceContextValue>({});

/**
 * 协议渲染核心：把一份 form schema 交给 @alien-form/react 渲染。
 * 数据源联动已在编译期解析（$af-dataSource 插件），运行时不再需要 handler 表。
 */
export function SchemaRenderer({
  mode,
  schema,
  initialValues,
  formKey,
  preserveValuesOnRebuild = false,
  onFormReady,
}: SchemaRendererProps) {
  const resources = useContext(RuntimeResourceContext);
  const previousFormRef = useRef<FormInstance | null>(null);
  const rebuildInitialValues =
    preserveValuesOnRebuild && previousFormRef.current
      ? previousFormRef.current.values()
      : initialValues;
  const form = useCreateForm(
    {
      schema,
      initialValues: rebuildInitialValues,
      scope: resources.scope,
      handlers: resources.handlers as never,
    },
    [mode, schema, formKey, resources.scope, resources.handlers],
  );
  useEffect(() => {
    previousFormRef.current = form;
    onFormReady?.(form);
  }, [form, onFormReady]);

  return (
    <FieldModeScope value={mode}>
      <FormProvider
        form={form}
        components={{ ...fieldComponents, ...resources.components } as never}
        decorators={{ ...fieldDecorators, ...resources.decorators } as never}
      >
        <Suspense fallback={null}>
          <SchemaField />
        </Suspense>
      </FormProvider>
    </FieldModeScope>
  );
}
