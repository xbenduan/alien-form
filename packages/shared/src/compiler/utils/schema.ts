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
export function getChildProperties(field: IFieldSchema): Record<string, IFieldSchema> | undefined {
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

// ─── 引用值 { $ref, value, label }（服务端读路径展开的引用字段）──────────────

/** 引用字段展开后的形状：value 为 join 键原值（回写用），label 为展示名。 */
export interface RefValue {
  $ref: string;
  value: unknown;
  label: string;
}

/** 是否为引用对象 { $ref, value, label }。 */
export function isRefValue(value: unknown): value is RefValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "$ref" in value &&
    "value" in value
  );
}

/** 取引用对象的 join 键原值（用于回写 / 匹配选项）；非引用对象原样返回。 */
export function refValue(value: unknown): unknown {
  return isRefValue(value) ? value.value : value;
}

/**
 * 为「引用对象回显」补一个 echo 选项：远程分页可能没拉到当前值对应的选项，
 * 但引用对象自带 label，据此拼一个 { value, label } 前置进选项，保证回显出 name。
 * value 可为单个引用对象或引用对象数组（多值）。已存在同 value 的选项则不重复添加。
 */
export function withRefEchoOptions(
  options: DataSourceItem[],
  value: unknown,
): DataSourceItem[] {
  const echoes: DataSourceItem[] = [];
  const add = (item: unknown) => {
    if (!isRefValue(item)) return;
    if (options.some((option) => option.value === item.value)) return;
    if (echoes.some((option) => option.value === item.value)) return;
    echoes.push({ value: item.value, label: item.label !== "" ? item.label : String(item.value) });
  };
  if (Array.isArray(value)) value.forEach(add);
  else add(value);
  return echoes.length ? [...echoes, ...options] : options;
}

export function isEmptyValue(value: unknown): boolean {
  if (isRefValue(value)) return isEmptyValue(value.value);
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function optionLabel(value: unknown, dataSource?: DataSourceItem[]): string {
  // 引用对象自带 label，优先使用（无需候选集翻译）
  if (isRefValue(value)) return value.label !== "" ? value.label : String(value.value);
  const hit = dataSource?.find((item) => item.value === value);
  return String(hit?.label ?? value);
}

export const EMPTY_TEXT = "—";

/** 把任意值转成可读文本（不含 React），用于 table 摘要与 tooltip。 */
export function toDisplayText(value: unknown, dataSource?: DataSourceItem[]): string {
  if (isEmptyValue(value)) return EMPTY_TEXT;
  // 引用对象自带 label
  if (isRefValue(value)) return optionLabel(value);
  if (Array.isArray(value)) {
    // 引用对象数组（m2m 展开）逐项取 label；其余对象数组折叠为计数
    const hasNonRefObject = value.some(
      (item) => item && typeof item === "object" && !Array.isArray(item) && !isRefValue(item),
    );
    if (hasNonRefObject) return `共 ${value.length} 项`;
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
