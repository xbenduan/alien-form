import React from "react";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  type IFormSchema,
} from "@alien-form/react";
import { Input, Select, FormItem } from "@/adapters";

const schema: IFormSchema = {
  type: "object",
  properties: {
    count: {
      type: "string",
      title: "Count",
      component: "Select",
      decorator: "FormItem",
      default: "1",
      dataSource: [
        { label: "1", value: "1" },
        { label: "5", value: "5" },
        { label: "10", value: "10" },
        { label: "100", value: "100" },
      ],
      order: 10,
    },
    items: {
      type: "string",
      title: "Items",
      component: "Input",
      decorator: "FormItem",
      props: { placeholder: "Title changes based on count" },
      order: 20,
      "x-reaction": {
        title: "{{ 'Items (total: ' + count + ')' }}",
      },
    },
  },
};

const components = { Input, Select };
const decorators = { FormItem };

export default function ReactionCase6() {
  const form = useCreateForm({ schema });
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField />
    </FormProvider>
  );
}
