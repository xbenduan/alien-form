import type { DataSourceItem, RuntimeRuleContext } from "@alien-form/core";

export interface FieldService {
  model: string;
  valueKey: string;
  labelKey: string;
}

export interface RefValue {
  $ref: string;
  value: unknown;
  label: string;
}

export function isRefValue(value: unknown): value is RefValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "$ref" in value &&
    "value" in value
  );
}

export function refValue(value: unknown): unknown {
  return isRefValue(value) ? value.value : value;
}

export function withRefEchoOptions(
  options: DataSourceItem[],
  value: unknown,
): DataSourceItem[] {
  const echoes: DataSourceItem[] = [];
  const add = (item: unknown) => {
    if (!isRefValue(item)) return;
    if (options.some((option) => option.value === item.value)) return;
    if (echoes.some((option) => option.value === item.value)) return;
    echoes.push({ value: item.value, label: item.label || String(item.value) });
  };
  if (Array.isArray(value)) value.forEach(add);
  else add(value);
  return echoes.length ? [...echoes, ...options] : options;
}

export function serializeMultiValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "string") return value;
  return JSON.stringify([value]);
}

export function parseMultiValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const multiValueFormat = {
  input: (context: RuntimeRuleContext) => serializeMultiValue(context.value),
  output: (context: RuntimeRuleContext) => parseMultiValue(context.value),
};

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
  if (isRefValue(value)) return value.label || String(value.value);
  const hit = dataSource?.find((item) => item.value === value);
  return String(hit?.label ?? value);
}

export const EMPTY_TEXT = "—";

export function toDisplayText(value: unknown, dataSource?: DataSourceItem[]): string {
  if (isEmptyValue(value)) return EMPTY_TEXT;
  if (isRefValue(value)) return optionLabel(value);
  if (Array.isArray(value)) {
    const hasObject = value.some(
      (item) => item && typeof item === "object" && !Array.isArray(item) && !isRefValue(item),
    );
    if (hasObject) return `共 ${value.length} 项`;
    const items = value
      .filter((item) => !isEmptyValue(item))
      .map((item) => optionLabel(item, dataSource));
    return items.length > 0 ? items.join(", ") : EMPTY_TEXT;
  }
  if (typeof value === "boolean") return value ? "是" : "否";
  if (value && typeof value === "object") {
    const count = Object.values(value).filter((item) => !isEmptyValue(item)).length;
    return count > 0 ? `已配置 ${count} 项` : EMPTY_TEXT;
  }
  return optionLabel(value, dataSource);
}

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
