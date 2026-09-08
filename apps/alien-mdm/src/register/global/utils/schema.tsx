import type { ReactNode } from "react";
import type { TableColumnsType } from "antd";
import { SchemaComponent, type ValueSource } from "@alien-form/react";
import {
  compileRuntimeValue,
  type DatabaseColumnType,
  type ModelFieldSchema,
  type FieldSchema,
} from "@alien-form/engine";

function defaultComponent(field: FieldSchema): string {
  if (field.type === "array") return "ArrayCards";
  if (field.type === "object") return "ObjectField";
  return "Input";
}

export interface FilterField {
  name: string;
  title: string;
  type: DatabaseColumnType;
  render(value: unknown, onChange: (value: unknown) => void): ReactNode;
}

function isComplex(field: FieldSchema): boolean {
  return field.type === "object" || field.type === "array";
}

const EMPTY_SCOPE: Record<string, unknown> = {};

function readScope(scope: ValueSource<Record<string, unknown>>): Record<string, unknown> {
  return typeof scope === "function" ? scope() : scope;
}

/**
 * 遍历 fields（存储真相源）产出 [key, field] 序列；缺省时回退遍历 form-schema.properties。
 * component/props 始终从 form-schema 按 key 取。
 */
function orderedFields(
  properties: Record<string, FieldSchema>,
  fields?: ModelFieldSchema[],
): { key: string; field: FieldSchema; column: ModelFieldSchema }[] {
  const source = fields ?? [];
  return source
    .filter((column) => properties[column.key])
    .map((column) => ({ key: column.key, field: properties[column.key], column }));
}

/**
 * 列集合与可见性由 fields 决定：遍历 fields（visible），渲染组件从 form-schema 按 key 取。
 */
export function schemaToColumns<T extends object = Record<string, unknown>>(
  schema?: FieldSchema,
  scope: ValueSource<Record<string, unknown>> = EMPTY_SCOPE,
  domain?: string,
  fields?: ModelFieldSchema[],
): TableColumnsType<T> {
  return orderedFields(schema?.properties ?? {}, fields).map(({ key, field, column }) => {
    const schemaProps = compileRuntimeValue({
      ...field.props,
      dataSource: field.dataSource,
    });
    return {
      key,
      dataIndex: key,
      title: field.title ?? column.table?.title ?? key,
      sorter: column.storage === "physical" && column.database?.type !== "json",
      hidden: column.table?.hidden === true,
      ellipsis: field.type !== "object" && field.type !== "array",
      render(value: unknown, record: T) {
        return (
          <SchemaComponent
            code={field.component ?? defaultComponent(field)}
            domain={domain}
            schemaProps={schemaProps}
            scope={() => ({
              ...readScope(scope),
              $value: value,
              $row: record,
            })}
            controlProps={{
              value,
              mode: "detail",
              isTable: true,
              schema: field,
              title: field.title ?? key,
              description: field.description,
              domain,
            }}
          />
        );
      },
    };
  });
}

/**
 * 筛选器集合由 fields 决定：遍历 fields（filterable 且非 object/array），组件从 form-schema 按 key 取。
 */
export function schemaToFilterFields(
  schema?: FieldSchema,
  scope: ValueSource<Record<string, unknown>> = EMPTY_SCOPE,
  domain?: string,
  fields?: ModelFieldSchema[],
): FilterField[] {
  return orderedFields(schema?.properties ?? {}, fields)
    .filter(({ field, column }) => column.filter?.hidden !== true && !isComplex(field))
    .map(({ key: name, field, column }) => {
      const schemaProps = compileRuntimeValue({
        ...field.props,
        dataSource: field.dataSource,
      });
      return {
        name,
        title: field.title ?? name,
        type: column.database?.type ?? "text",
        render(value: unknown, onChange: (value: unknown) => void): ReactNode {
          return (
            <SchemaComponent
              code={field.component ?? "Input"}
              domain={domain}
              schemaProps={schemaProps}
              scope={() => ({
                ...readScope(scope),
                $value: value,
              })}
              controlProps={{
                value,
                onChange,
                mode: "edit",
                isFilter: true,
                schema: field,
                domain,
              }}
            />
          );
        },
      };
    });
}
