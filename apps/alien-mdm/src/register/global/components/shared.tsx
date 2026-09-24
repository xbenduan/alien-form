import type { ReactNode } from "react";
import type { ComponentProps } from "@alien-form/react";
import type { AlienFieldSchema } from "@alien-form/engine";
import type { FieldGridProps } from "@utils/field-grid";

/** 关联字段在详情与编辑回显时使用的结构化值。 */
export interface ReferenceValue {
  $ref: string;
  value: unknown;
  label?: ReactNode;
}

/** 判断值是否为后端返回的关联引用。 */
export function isReferenceValue(value: unknown): value is ReferenceValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Partial<ReferenceValue>).$ref === "string" &&
    "value" in value
  );
}

/** 将关联引用还原为表单控件消费的原始值。 */
export function referenceValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(referenceValue);
  return isReferenceValue(value) ? value.value : value;
}

/** object/array 复合字段共用的表现属性（标题、描述、表格态、schema、domain 与栅格）。 */
export type ComplexFieldProps = ComponentProps &
  FieldGridProps & {
    title?: string;
    description?: string;
    isTable?: boolean;
    schema?: AlienFieldSchema;
    domain?: string;
  };

/** 详情态下把任意值渲染为可读文本。 */
export function displayValue(value: any): ReactNode {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "object") {
    if (value?.["$ref"]) return value?.label ?? value?.value;
    return JSON.stringify(value);
  }
  return String(value);
}

export function DetailValue({ value }: { value: unknown }) {
  return (
    <div className="min-h-5.5 wrap-anywhere whitespace-pre-wrap leading-5.5 text-[#262626]">
      {displayValue(value)}
    </div>
  );
}

export type FieldMode = "add" | "edit" | "detail";

export interface BuiltProps {
  mode: FieldMode;
  controlProps: Record<string, unknown>;
  field: ComponentProps["field"];
  node: ComponentProps["node"];
  children?: ReactNode;
  title?: string;
  description?: string;
  gridSpan?: unknown;
  columns?: unknown;
  gutter?: unknown;
  domain?: string;
  isTable: boolean;
  schema?: AlienFieldSchema;
  renderRow?: ComponentProps["renderRow"];
  value: unknown;
  onChange?: (value: unknown) => void;
  isFilter: boolean;
  loading?: boolean;
  dataSource?: unknown[];
  extraProps: Record<string, unknown>;
}

/** 统一处理字段场景，并产出组件可消费的控制属性。 */
export function buildProps(props: ComponentProps, extraRuntimeProps: string[] = []): BuiltProps {
  const result = { ...props };
  for (const key of [
    "value",
    "onChange",
    "mode",
    "form",
    "slots",
    "children",
    "field",
    "node",
    "domain",
    "dataSource",
    "loading",
    "title",
    "description",
    "isFilter",
    "gridSpan",
    "columns",
    "gutter",
    "isTable",
    "schema",
    "renderRow",
    "onOptionsChange",
    ...extraRuntimeProps,
  ]) {
    delete result[key];
  }
  const isFilter = props.isFilter === true;
  const mode: FieldMode = isFilter
    ? "edit"
    : props.isTable === true || props.readOnly === true || props.mode === "detail"
      ? "detail"
      : props.mode === "add"
        ? "add"
        : "edit";
  return {
    mode,
    controlProps: result,
    field: props.field,
    node: props.node,
    children: props.children,
    title: props.title as string | undefined,
    description: props.description as string | undefined,
    gridSpan: props.gridSpan,
    columns: props.columns,
    gutter: props.gutter,
    domain: props.domain as string | undefined,
    isTable: props.isTable === true,
    schema: props.schema as AlienFieldSchema | undefined,
    renderRow: props.renderRow,
    value: props.value,
    onChange: props.onChange,
    isFilter,
    loading: props.loading,
    dataSource: props.dataSource,
    extraProps: Object.fromEntries(extraRuntimeProps.map((key) => [key, props[key]])),
  };
}
