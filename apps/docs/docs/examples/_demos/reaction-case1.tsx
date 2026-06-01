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
    trigger1: {
      type: "string",
      title: "Trigger (trigger1)",
      component: "Select",
      decorator: "FormItem",
      default: "show",
      dataSource: [
        { label: "Show target1", value: "show" },
        { label: "Hide target1", value: "hide" },
        { label: "Remove target1", value: "none" },
      ],
      props: { placeholder: "Select to control target1 display" },
      order: 10,
    },
    target1: {
      type: "string",
      title: "Target (target1)",
      component: "Input",
      decorator: "FormItem",
      default: "I should show/hide based on trigger1",
      order: 20,
      "x-reaction": {
        display:
          "{{ trigger1 === 'hide' ? 'hidden' : trigger1 === 'none' ? 'none' : 'visible' }}",
      },
    },
  },
};

const components = { Input, Select };
const decorators = { FormItem };

export default function ReactionCase1() {
  const form = useCreateForm({ schema });
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField />
    </FormProvider>
  );
}
