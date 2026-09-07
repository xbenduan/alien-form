import type { ReactNode } from "react";
import type { ComponentProps } from "@binding";
import type { FieldSchema } from "@alien-form/engine";
import type { FieldGridProps } from "@utils/field-grid";
import styles from "./index.module.css";

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
  value: unknown;
  onChange?: (value: unknown) => void;
  isFilter: boolean;
  loading?: boolean;
  dataSource?: unknown[];
  extraProps: Record<string, unknown>;
}

/** 统一处理字段场景，并产出组件可消费的控制属性。 */
export function buildProps(
  props: ComponentProps,
  extraRuntimeProps: string[] = [],
): BuiltProps {
  const result = { ...props };
  for (const key of [
    "value",
    "onChange",
    "mode",
    "form",
    "field",
    "node",
    "slots",
    "children",
    "dataSource",
    "loading",
    "title",
    "description",
    "isFilter",
    "gridSpan",
    "columns",
    "gutter",
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
    value: props.value,
    onChange: props.onChange,
    isFilter,
    loading: props.loading,
    dataSource: props.dataSource,
    extraProps: Object.fromEntries(extraRuntimeProps.map((key) => [key, props[key]])),
  };
}
