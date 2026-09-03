import type { ReactNode } from "react";
import type { ComponentProps } from "@binding";
import type { FieldSchema } from "@engine";
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
export function displayValue(value: unknown): ReactNode {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function DetailValue({ value }: { value: unknown }) {
  return <div className={styles.detailValue}>{displayValue(value)}</div>;
}

/** 剔除运行时注入的非原生属性，仅保留可透传给 antd 组件的 props。 */
export function nativeProps(props: ComponentProps): Record<string, unknown> {
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
  ]) {
    delete result[key];
  }
  return result;
}
