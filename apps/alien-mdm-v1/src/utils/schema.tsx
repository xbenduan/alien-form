import type { ComponentType } from "react";
import { createElement } from "react";
import type { TableColumnsType } from "antd";
import type { FieldSchema, Runtime } from "@engine";

interface TableFieldProps {
  value?: unknown;
  mode: "detail";
  isTable: true;
  schema: FieldSchema;
  title: string;
  domain?: string;
  [key: string]: unknown;
}

function defaultComponent(field: FieldSchema): string {
  if (field.type === "array") return "ArrayCards";
  if (field.type === "object") return "ObjectField";
  return "Input";
}

export function schemaToColumns(runtime: Runtime) {
  return function createColumns<T extends object = Record<string, unknown>>(
    schema?: FieldSchema,
    domain?: string,
  ): TableColumnsType<T> {
    return Object.entries(schema?.properties ?? {})
      .filter(([, field]) => field["x-table"]?.visible !== false)
      .map(([key, field]) => {
        const Component = runtime.component(field.component ?? defaultComponent(field), domain) as
          | ComponentType<TableFieldProps>
          | undefined;
        return {
          key,
          dataIndex: key,
          title: field.title ?? key,
          width: field["x-table"]?.width,
          fixed: field["x-table"]?.fixed,
          ellipsis: field.type !== "object" && field.type !== "array",
          render(value: unknown) {
            if (!Component) return "—";
            return createElement(Component, {
              ...field.props,
              value,
              mode: "detail",
              isTable: true,
              schema: field,
              title: field.title ?? key,
              description: field.description,
              dataSource: field.dataSource,
              domain,
            });
          },
        };
      });
  };
}

export function schemaToFields(schema?: FieldSchema): Array<{
  name: string;
  title: string;
  type?: string;
}> {
  return Object.entries(schema?.properties ?? {})
    .filter(
      ([, field]) =>
        field["x-table"]?.filterable === true ||
        (field["x-database"] as { filterable?: boolean } | undefined)?.filterable === true,
    )
    .map(([name, field]) => ({
      name,
      title: field.title ?? name,
      type: field.type,
    }));
}
