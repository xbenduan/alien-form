import { SkuTable } from "@/alien-business/sku-table";
import { Specs } from "@/alien-business/specs";
import { SpecValues } from "@/alien-business/spec-values";
import { linkSpecAndSku } from "@/alien-business/link-spec-sku";
import { schemaRendererHandlers } from "@/mock";
import { FormProvider, IFormSchema, SchemaField, useCreateForm, type IForm } from "@alien-form/react";
import { ArrayCards, FormItem, FormSection, SchemaInput, SchemaSelect, SchemaSwitch, SchemaTextarea } from "@alien-form/ui";
import { useMemo, useImperativeHandle, forwardRef, useState } from "react";
import type React from "react";

const baseComponents: Record<string, React.ComponentType<any>> = {
  Input: SchemaInput,
  Select: SchemaSelect,
  Textarea: SchemaTextarea,
  Switch: SchemaSwitch,
  ArrayCards,
  SkuTable,
  Specs,
  SpecValues,
  Section: FormSection,
};
const baseDecorators = { FormItem };

export interface AlienFormRef {
  form: IForm;
}

export interface AlienFormProps {
  schema: IFormSchema;
  components?: Record<string, any>;
  decorators?: Record<string, any>;
  data?: any;
  /** 提交回调，接收表单值。不传则不显示提交按钮。 */
  onSubmit?: (values: Record<string, any>) => void | Promise<void>;
  /** 重置回调。不传但 onSubmit 存在时仍显示重置按钮。 */
  onReset?: () => void;
  /** 提交按钮文案 */
  submitText?: string;
  /** 重置按钮文案 */
  resetText?: string;
}

export const AlienForm = forwardRef<AlienFormRef, AlienFormProps>(({
  schema,
  components,
  decorators,
  data,
  onSubmit,
  onReset,
  submitText = "提交",
  resetText = "重置",
}, ref) => {
  const form = useCreateForm({
    initialValues: data,
    handlers: schemaRendererHandlers,
    setup: (form) => {
      const disposeSpecSku = form.effect(() => {
        linkSpecAndSku(form);
      });
      return () => {
        disposeSpecSku();
      };
    },
  });

  const [submitting, setSubmitting] = useState(false);

  useImperativeHandle(ref, () => ({ form }), [form]);

  const mergedComponents = useMemo(() => ({ ...baseComponents, ...components }), []);
  const mergedDecorators = useMemo(() => ({ ...baseDecorators, ...decorators }), []);

  const handleSubmit = async () => {
    if (!onSubmit) return;
    setSubmitting(true);
    try {
      const valid = await form.validate();
      if (!valid) return;
      await onSubmit(form.values);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    form.reset();
    onReset?.();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <FormProvider form={form} components={mergedComponents} decorators={mergedDecorators}>
        <SchemaField schema={schema} />
        {onSubmit && (
          <div className="flex items-center gap-3 border-t pt-6 mt-6">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitting ? "提交中…" : submitText}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
            >
              {resetText}
            </button>
          </div>
        )}
      </FormProvider>
    </div>
  );
});

AlienForm.displayName = "AlienForm";
