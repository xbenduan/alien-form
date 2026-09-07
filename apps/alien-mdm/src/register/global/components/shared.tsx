import type { ReactNode } from "react";
import type { ComponentProps } from "@alien-form/react";
import type { FieldSchema } from "@alien-form/engine";
import type { FieldGridProps } from "@utils/field-grid";
import styles from "./shared.module.css";

/** object/array 复合字段共用的表现属性（标题、描述、表格态、schema、domain 与栅格）。 */
export type ComplexFieldProps = ComponentProps &
  FieldGridProps & {
    title?: string;
    description?: string;
    isTable?: boolean;
    schema?: FieldSchema;
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
  return <div className={styles.detailValue}>{displayValue(value)}</div>;
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
  schema?: FieldSchema;
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
    schema: props.schema as FieldSchema | undefined,
    renderRow: props.renderRow,
    value: props.value,
    onChange: props.onChange,
    isFilter,
    loading: props.loading,
    dataSource: props.dataSource,
    extraProps: Object.fromEntries(extraRuntimeProps.map((key) => [key, props[key]])),
  };
}
