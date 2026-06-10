/**
 * @alien-form/core — Validation utilities
 */
import type { FieldError, DataSourceItem } from "./types";

export function isEmptyValue(value: any): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

export function normalizeDataSource(ds?: any[] | null): DataSourceItem[] {
  if (!ds || !Array.isArray(ds)) return [];
  return ds.map((item) => {
    if (typeof item === "string" || typeof item === "number") return { label: String(item), value: item };
    if (item && "key" in item && "title" in item && !("label" in item)) return { label: String(item.title), value: item.key, ...item };
    return item as DataSourceItem;
  });
}

export function normalizeValidationErrors(result: any): FieldError[] {
  if (result === undefined || result === null || result === true) return [];
  if (result === false) return [{ message: "Invalid value", type: "x-validate" }];
  if (typeof result === "string") return [{ message: result, type: "x-validate" }];
  const values = Array.isArray(result) ? result : [result];
  const errors: FieldError[] = [];
  for (const item of values) {
    if (item === undefined || item === null || item === true) continue;
    if (item === false) { errors.push({ message: "Invalid value", type: "x-validate" }); continue; }
    if (typeof item === "string") { errors.push({ message: item, type: "x-validate" }); continue; }
    if (typeof item === "object" && "message" in item) errors.push({ message: item.message, type: item.type || "x-validate" });
  }
  return errors;
}
