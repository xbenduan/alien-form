import { SkuTable } from "@/alien-business/sku-table";
import { ImageInput } from "@/alien-shared/image-input";
import { schemaRendererHandlers } from "@/mock";
import { FormProvider, IFormSchema, SchemaField, useCreateForm } from "@alien-form/react";
import { ArrayCards, FormItem, SchemaInput, SchemaSelect, Switch, Textarea } from "@alien-form/ui";
import { useMemo } from "react";

const baseComponents = {
  Input: SchemaInput,
  Select: SchemaSelect,
  Textarea,
  Switch,
  ArrayCards,
  ImageInput,
  SkuTable,
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
