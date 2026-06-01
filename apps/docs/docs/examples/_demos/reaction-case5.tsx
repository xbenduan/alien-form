import React from "react";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  type IFormSchema,
  type FormConfig,
} from "@alien-form/react";
import { Select, FormItem } from "@/adapters";

const schema: IFormSchema = {
  type: "object",
  properties: {
    country: {
      type: "string",
      title: "Country",
      component: "Select",
      decorator: "FormItem",
      default: "cn",
      dataSource: [
        { label: "China", value: "cn" },
        { label: "USA", value: "us" },
        { label: "Japan", value: "jp" },
      ],
      order: 10,
    },
    city: {
      type: "string",
      title: "City (linked options)",
      component: "Select",
      decorator: "FormItem",
      props: { placeholder: "Shows different cities by country" },
      order: 20,
      "x-reaction": {
        dataSource: "@cityOptions",
        value: undefined,
      },
    },
  },
};

const handlers: FormConfig["handlers"] = {
  cityOptions: (ctx) => {
    const country = ctx.get("country");
    if (country === "cn")
      return [
        { label: "Beijing", value: "beijing" },
        { label: "Shanghai", value: "shanghai" },
        { label: "Shenzhen", value: "shenzhen" },
      ];
    if (country === "us")
      return [
        { label: "New York", value: "nyc" },
        { label: "San Francisco", value: "sf" },
        { label: "Los Angeles", value: "la" },
      ];
    if (country === "jp")
      return [
        { label: "Tokyo", value: "tokyo" },
        { label: "Osaka", value: "osaka" },
        { label: "Kyoto", value: "kyoto" },
      ];
    return [];
  },
};

const components = { Select };
const decorators = { FormItem };

export default function ReactionCase5() {
  const form = useCreateForm({ schema, handlers });
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField />
    </FormProvider>
  );
}
