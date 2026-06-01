import React from "react";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  type IFormSchema,
} from "@alien-form/react";
import { Input, Select, FormItem, ArrayCards } from "@/adapters";

const schema: IFormSchema = {
  type: "object",
  properties: {
    rows: {
      type: "array",
      title: "Dynamic Rows (push and observe in-row reactions)",
      component: "ArrayCards",
      decorator: "FormItem",
      props: { addText: "+ Add Row" },
      order: 10,
      items: {
        type: "object",
        properties: {
          rowType: {
            type: "string",
            title: "Row Type",
            component: "Select",
            decorator: "FormItem",
            default: "text",
            dataSource: [
              { label: "Text", value: "text" },
              { label: "Number", value: "number" },
              { label: "Hidden Detail", value: "hidden" },
            ],
            order: 10,
          },
          rowDetail: {
            type: "string",
            title: "Row Detail",
            component: "Input",
            decorator: "FormItem",
            props: { placeholder: "Visibility controlled by rowType" },
            order: 20,
            "x-reaction": {
              display: "{{ rowType === 'hidden' ? 'none' : 'visible' }}",
              title: "{{ 'Detail (' + rowType + ' mode)' }}",
            },
          },
        },
      },
    },
  },
};

const components = { Input, Select, ArrayCards };
const decorators = { FormItem };

export default function ReactionCase7() {
  const form = useCreateForm({ schema });
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField />
    </FormProvider>
  );
}
