import { SkuTable } from "@/alien-business/sku-table";
import { Specs } from "@/alien-business/specs";
import { SpecValues } from "@/alien-business/spec-values";
import { schemaRendererHandlers } from "@/mock";
import { FormProvider, IFormSchema, SchemaField, useCreateForm } from "@alien-form/react";
import { ArrayCards, FormItem, SchemaInput, SchemaSelect, Switch, Textarea } from "@alien-form/ui";
import { useMemo } from "react";

const baseComponents: Record<string, React.ComponentType<any>> = {
  Input: SchemaInput,
  Select: SchemaSelect,
  Textarea,
  Switch,
  ArrayCards,
  SkuTable,
  Specs,
  SpecValues,
};
const baseDecorators = { FormItem };

export const AlienForm: React.FC<{
  schema: IFormSchema;
  components?: Record<string, any>;
  decorators?: Record<string, any>;
  data?: any;
}> = ({ schema, components, decorators, data }) => {
  const form = useCreateForm({
    initialValues: data,
    handlers: schemaRendererHandlers,
  });

  const mergedComponents = useMemo(() => ({ ...baseComponents, ...components }), []);
  const mergedDecorators = useMemo(() => ({ ...baseDecorators, ...decorators }), []);

  return (
    <FormProvider form={form} components={mergedComponents} decorators={mergedDecorators}>
      <SchemaField schema={schema}></SchemaField>
    </FormProvider>
  );
};
