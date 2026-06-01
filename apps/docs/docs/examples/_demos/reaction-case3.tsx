import React from "react";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  type IFormSchema,
  type FormConfig,
} from "@alien-form/react";
import { Input, Select, FormItem } from "@/adapters";

const schema: IFormSchema = {
  type: "object",
  properties: {
    role: {
      type: "string",
      title: "Role",
      component: "Select",
      decorator: "FormItem",
      default: "viewer",
      dataSource: [
        { label: "Admin", value: "admin" },
        { label: "Editor", value: "editor" },
        { label: "Viewer", value: "viewer" },
      ],
      order: 10,
    },
    secretField: {
      type: "string",
      title: "Restricted Field",
      component: "Input",
      decorator: "FormItem",
      default: "Only admin can edit",
      order: 20,
      "x-reaction": {
        disabled: "@isNotAdmin",
      },
    },
  },
};

const handlers: FormConfig["handlers"] = {
  isNotAdmin: (ctx) => {
    const role = ctx.get("role");
    return role !== "admin";
  },
};

const components = { Input, Select };
const decorators = { FormItem };

export default function ReactionCase3() {
  const form = useCreateForm({ schema, handlers });
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField />
    </FormProvider>
  );
}
