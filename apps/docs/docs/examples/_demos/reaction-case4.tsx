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
    enableA: {
      type: "string",
      title: "Switch A",
      component: "Select",
      decorator: "FormItem",
      default: "no",
      dataSource: [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" },
      ],
      order: 10,
    },
    enableB: {
      type: "string",
      title: "Switch B",
      component: "Select",
      decorator: "FormItem",
      default: "no",
      dataSource: [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" },
      ],
      order: 20,
    },
    conditionalField: {
      type: "string",
      title: "Conditionally Required — required when both A and B are 'Yes'",
      component: "Input",
      decorator: "FormItem",
      props: { placeholder: "Required when enableA=yes AND enableB=yes" },
      order: 30,
      "x-reaction": {
        required: "{{ enableA === 'yes' && enableB === 'yes' }}",
      },
    },
  },
};

const components = { Input, Select };
const decorators = { FormItem };

export default function ReactionCase4() {
  const form = useCreateForm({ schema });
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField />
    </FormProvider>
  );
}
