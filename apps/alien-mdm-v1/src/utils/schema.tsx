import type { ComponentType, ReactNode } from "react";
import { createElement } from "react";
import type { TableColumnsType } from "antd";
import { compileExpr, type ExpressionScope } from "@alien-form/core";
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

export interface FilterField {
  name: string;
  title: string;
  render(value: unknown, onChange: (value: unknown) => void): ReactNode;
}

interface FilterFieldProps {
  value?: unknown;
  onChange: (value: unknown) => void;
  mode: "edit";
  isFilter: true;
  schema: FieldSchema;
  dataSource?: unknown;
  domain?: string;
  [key: string]: unknown;
}

function isFilterable(field: FieldSchema): boolean {
  return field["x-table"]?.filterable === true;
}

function isComplex(field: FieldSchema): boolean {
  return field.type === "object" || field.type === "array";
}

function isExpression(value: unknown): value is string {
  return typeof value === "string" && value.trim().startsWith("{{") && value.trim().endsWith("}}");
}

/**
 * 按“静态 scope”求值:仅解析 $service/$utils/$enums/$query 等页面级稳定依赖,
 * 不订阅字段值信号,因此不支持跨字段联动。用于 filter 这类独立查询条件的取值。
 */
function resolveStatic(value: unknown, scope: Record<string, unknown>): unknown {
  if (isExpression(value)) return compileExpr(value)(scope as unknown as ExpressionScope);
  if (Array.isArray(value)) return value.map((item) => resolveStatic(item, scope));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, resolveStatic(child, scope)]),
  );
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

export function schemaToFilters(runtime: Runtime) {
  return function createFilters(
    schema?: FieldSchema,
    scope?: Record<string, unknown>,
    domain?: string,
  ): FilterField[] {
    return Object.entries(schema?.properties ?? {})
      .filter(([, field]) => isFilterable(field) && !isComplex(field))
      .map(([name, field]) => {
        const Component = runtime.component(field.component ?? "Input", domain) as
          | ComponentType<FilterFieldProps>
          | undefined;
        const props = scope
          ? (resolveStatic(field.props, scope) as Record<string, unknown>)
          : field.props;
        const dataSource = scope ? resolveStatic(field.dataSource, scope) : field.dataSource;
        return {
          name,
          title: field.title ?? name,
          render(value: unknown, onChange: (value: unknown) => void): ReactNode {
            if (!Component) return null;
            return createElement(Component, {
              ...props,
              value,
              onChange,
              mode: "edit",
              isFilter: true,
              schema: field,
              dataSource,
              domain,
            });
          },
        };
      });
  };
}
