import React from "react";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  type IFormSchema,
} from "@alien-form/react";
import { Input, FormItem } from "@/adapters";

const schema: IFormSchema = {
  type: "object",
  properties: {
    firstName: {
      type: "string",
      title: "First Name",
      component: "Input",
      decorator: "FormItem",
      default: "Zhang",
      props: { placeholder: "Enter first name" },
      order: 10,
    },
    lastName: {
      type: "string",
      title: "Last Name",
      component: "Input",
      decorator: "FormItem",
      default: "San",
      props: { placeholder: "Enter last name" },
      order: 20,
    },
    fullName: {
      type: "string",
      title: "Full Name (auto-computed)",
      component: "Input",
      decorator: "FormItem",
      props: { placeholder: "Computed by reaction", disabled: true },
      order: 30,
      "x-reaction": {
        value: "{{ firstName + lastName }}",
      },
    },
  },
};

const components = { Input };
const decorators = { FormItem };

export default function ReactionCase2() {
  const form = useCreateForm({ schema });
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField />
    </FormProvider>
  );
}
