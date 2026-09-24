import type { AlienSchema, ModelRecord } from "@alien-form/protocol";
import { AppError } from "../../errors.ts";
import type { CompiledModel } from "./contracts.ts";

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function assertFieldValue(field: AlienSchema["fields"][number], value: unknown): void {
  if (isEmpty(value)) {
    if (field.required === true) throw new AppError(`${field.key} 必填`, 400);
    return;
  }
  const type = field.type;
  if (type === "string" && typeof value !== "string") {
    throw new AppError(`${field.key} 必须为字符串`, 400);
  }
  if (type === "number" && typeof value !== "number") {
    throw new AppError(`${field.key} 必须为数字`, 400);
  }
  if (type === "boolean" && typeof value !== "boolean") {
    throw new AppError(`${field.key} 必须为布尔值`, 400);
  }
  if (type === "object" && (typeof value !== "object" || Array.isArray(value))) {
    throw new AppError(`${field.key} 必须为对象`, 400);
  }
  if (type === "array" && !Array.isArray(value)) {
    throw new AppError(`${field.key} 必须为数组`, 400);
  }
}

export function normalizeRecord(
  model: CompiledModel,
  values: Record<string, unknown>,
): ModelRecord {
  const fields = model.validation.fields;
  for (const key of Object.keys(values)) {
    if (!fields.has(key)) throw new AppError(`未知字段：${key}`, 400);
  }
  const record: ModelRecord = { id: String(values.id ?? "") };
  for (const field of fields.values()) {
    if (field.key === "id" || field.key === "createdAt" || field.key === "updatedAt") continue;
    let value = values[field.key];
    if (value === undefined && field.storage?.default !== undefined) {
      value = field.storage.default;
    }
    if (value === undefined && field.form.default !== undefined) value = field.form.default;
    assertFieldValue(field, value);
    if (value !== undefined) record[field.key] = value;
  }
  return record;
}

export function immutable(record: ModelRecord): Readonly<ModelRecord> {
  return Object.freeze({ ...record });
}
