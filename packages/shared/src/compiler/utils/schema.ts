import type { DataSourceItem, IFieldSchema } from "@alien-form/react";
import type { LeafField } from "../../types";
import { getComponentMeta } from "../../components/register";

/** 字段是否为复杂字段：object（含子 properties）或对象数组。 */
export function isComplexField(field: IFieldSchema): boolean {
  const meta = getComponentMeta(field.component);
  if (meta?.kind === "complex") return true;
  if (field.type === "object" && field.properties) return true;
  if (field.type === "array" && field.items && !Array.isArray(field.items)) return true;
  return false;
}

/** 取字段下的子字段 properties：对象取自身，对象数组取 items。 */
export function getChildProperties(
  field: IFieldSchema,
): Record<string, IFieldSchema> | undefined {
  if (field.type === "array" && field.items && !Array.isArray(field.items)) {
    return field.items.properties;
  }
  if (field.properties) return field.properties;
  return undefined;
}

/**
 * 递归整棵 schema 树，收集所有叶子字段（无子 properties 的字段）。
 * 复杂字段的子字段被平铺展开。
 */
export function collectLeafFields(
  properties: Record<string, IFieldSchema> | undefined,
): LeafField[] {
  const result: LeafField[] = [];
  const walk = (props: Record<string, IFieldSchema> | undefined) => {
    if (!props) return;
    for (const [key, field] of Object.entries(props)) {
      const children = getChildProperties(field);
      if (children) {
        walk(children);
        continue;
      }
      result.push({ key, field });
    }
  };
  walk(properties);
  return result;
}

// ─── 展示值格式化（detail / table 只读态共用）──────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft: "default",
  review: "processing",
  pending: "processing",
  published: "success",
  active: "success",
  archived: "warning",
  disabled: "warning",
  error: "error",
  failed: "error",
  deleted: "error",
};

export function statusColor(value: unknown): string {
  return STATUS_COLORS[String(value).toLowerCase()] ?? "default";
}

export function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function optionLabel(value: unknown, dataSource?: DataSourceItem[]): string {
  const hit = dataSource?.find((item) => item.value === value);
  return String(hit?.label ?? value);
}

export const EMPTY_TEXT = "—";

/** 把任意值转成可读文本（不含 React），用于 table 摘要与 tooltip。 */
export function toDisplayText(value: unknown, dataSource?: DataSourceItem[]): string {
  if (isEmptyValue(value)) return EMPTY_TEXT;
  if (Array.isArray(value)) {
    const hasObjectItems = value.some(
      (item) => item && typeof item === "object" && !Array.isArray(item),
    );
    if (hasObjectItems) return `共 ${value.length} 项`;
    const items = value
      .filter((item) => !isEmptyValue(item))
      .map((item) => optionLabel(item, dataSource));
    return items.length > 0 ? items.join(", ") : EMPTY_TEXT;
  }
  if (typeof value === "boolean") return value ? "是" : "否";
  if (value && typeof value === "object") {
    const count = Object.values(value as Record<string, unknown>).filter(
      (item) => !isEmptyValue(item),
    ).length;
    return count > 0 ? `已配置 ${count} 项` : EMPTY_TEXT;
  }
  return optionLabel(value, dataSource);
}
