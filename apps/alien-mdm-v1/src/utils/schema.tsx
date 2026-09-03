import type { ComponentType, ReactNode } from "react";
import { createElement } from "react";
import type { TableColumnsType } from "antd";
import { compileExpr, type ExpressionScope } from "@alien-form/core";
import type { DatabaseField, FieldSchema, Runtime } from "@engine";

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

/**
 * 遍历 fields（存储真相源）产出 [key, field] 序列；缺省时回退遍历 form-schema.properties。
 * component/props 始终从 form-schema 按 key 取。
 */
function orderedFields(
  properties: Record<string, FieldSchema>,
  fields?: DatabaseField[],
): { key: string; field: FieldSchema; column: DatabaseField }[] {
  const source = fields ?? Object.keys(properties).map((key) => ({ key }) as DatabaseField);
  return source
    .filter((column) => properties[column.key])
    .map((column) => ({ key: column.key, field: properties[column.key], column }));
}

/**
 * 列集合与可见性由 fields 决定：遍历 fields（visible），渲染组件从 form-schema 按 key 取。
 */
export function schemaToColumns(runtime: Runtime) {
  return function createColumns<T extends object = Record<string, unknown>>(
    schema?: FieldSchema,
    domain?: string,
    fields?: DatabaseField[],
  ): TableColumnsType<T> {
    return orderedFields(schema?.properties ?? {}, fields)
      .filter(({ column }) => column.visible !== false)
      .map(({ key, field }) => {
        const Component = runtime.component(field.component ?? defaultComponent(field), domain) as
          | ComponentType<TableFieldProps>
          | undefined;
        return {
          key,
          dataIndex: key,
          title: field.title ?? key,
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

/**
 * 筛选器集合由 fields 决定：遍历 fields（filterable 且非 object/array），组件从 form-schema 按 key 取。
 */
export function schemaToFilters(runtime: Runtime) {
  return function createFilters(
    schema?: FieldSchema,
    scope?: Record<string, unknown>,
    domain?: string,
    fields?: DatabaseField[],
  ): FilterField[] {
    return orderedFields(schema?.properties ?? {}, fields)
      .filter(({ field, column }) => column.filterable === true && !isComplex(field))
      .map(({ key: name, field }) => {
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
