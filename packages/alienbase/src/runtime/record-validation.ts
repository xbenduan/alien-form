import {
  isEmptyValue,
  validateValueConstraints,
  type AlienFieldSchema,
  type AlienSchema,
  type ModelRecord,
} from "@alien-form/protocol";
import { AppError } from "../errors.ts";
import type { CompiledModel } from "./contracts.ts";

function effectiveFieldSchema(field: AlienSchema["fields"][number]): AlienFieldSchema {
  return {
    ...field.form,
    type: field.type,
    title: field.title,
    required: field.required || undefined,
  };
}

function resolveSchema(
  model: AlienSchema,
  schema: AlienFieldSchema,
  seen: ReadonlySet<string> = new Set(),
): AlienFieldSchema {
  const ref = schema.$ref;
  if (!ref) return schema;
  if (seen.has(ref)) throw new AppError(`表单字段存在循环引用：${ref}`, 400);
  const target = ref.startsWith("#/definitions/")
    ? model.definitions?.[ref.slice("#/definitions/".length)]
    : ref.startsWith("#/fields/")
      ? model.fields
          .filter(({ key }) => key === ref.slice("#/fields/".length))
          .map(effectiveFieldSchema)[0]
      : undefined;
  if (!target) throw new AppError(`表单字段引用不存在：${ref}`, 400);
  const { $ref: _ref, ...overrides } = schema;
  return {
    ...resolveSchema(model, target, new Set([...seen, ref])),
    ...overrides,
  };
}

function cloneDefault(value: unknown): unknown {
  return value && typeof value === "object" ? structuredClone(value) : value;
}

function normalizeValue(
  model: AlienSchema,
  rawSchema: AlienFieldSchema,
  value: unknown,
  path: string,
): unknown {
  const schema = resolveSchema(model, rawSchema);
  const current = value === undefined ? cloneDefault(schema.default) : value;
  if (current === undefined || current === null) return current;

  if (
    schema.type === "object" &&
    typeof current === "object" &&
    !Array.isArray(current) &&
    schema.properties
  ) {
    const input = current as Record<string, unknown>;
    for (const key of Object.keys(input)) {
      if (!Object.hasOwn(schema.properties, key))
        throw new AppError(`未知字段：${path}.${key}`, 400);
    }
    return Object.fromEntries(
      Object.entries(schema.properties).flatMap(([key, child]) => {
        const normalized = normalizeValue(model, child, input[key], `${path}.${key}`);
        return normalized === undefined ? [] : [[key, normalized]];
      }),
    );
  }

  if (schema.type === "array" && Array.isArray(current) && schema.items) {
    if (Array.isArray(schema.items)) {
      const items = schema.items;
      return current.map((item, index) =>
        items[index] ? normalizeValue(model, items[index], item, `${path}.${index}`) : item,
      );
    }
    return current.map((item, index) =>
      normalizeValue(model, schema.items as AlienFieldSchema, item, `${path}.${index}`),
    );
  }
  return current;
}

function validateValue(
  model: AlienSchema,
  rawSchema: AlienFieldSchema,
  value: unknown,
  path: string,
  required = false,
): void {
  const schema = resolveSchema(model, rawSchema);
  const issue = validateValueConstraints(schema, value, {
    required: required || schema.required === true,
    label: path,
  })[0];
  if (issue) throw new AppError(issue.message, 400);
  if (isEmptyValue(value)) return;

  if (
    schema.type === "object" &&
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    schema.properties
  ) {
    const record = value as Record<string, unknown>;
    const requiredKeys = new Set(Array.isArray(schema.required) ? schema.required : []);
    for (const [key, child] of Object.entries(schema.properties)) {
      validateValue(model, child, record[key], `${path}.${key}`, requiredKeys.has(key));
    }
  }

  if (schema.type === "array" && Array.isArray(value) && schema.items) {
    if (Array.isArray(schema.items)) {
      for (const [index, item] of value.entries()) {
        const itemSchema = schema.items[index];
        if (itemSchema) validateValue(model, itemSchema, item, `${path}.${index}`);
      }
      return;
    }
    for (const [index, item] of value.entries()) {
      validateValue(model, schema.items, item, `${path}.${index}`);
    }
  }
}

/** 根据模型协议执行字段白名单、默认值和嵌套结构归一化。 */
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
      value = cloneDefault(field.storage.default);
    }
    const normalized = normalizeValue(model.schema, effectiveFieldSchema(field), value, field.key);
    if (normalized !== undefined) record[field.key] = normalized;
  }
  return record;
}

/** 在业务中间件之前统一执行 Schema 声明的基础表单校验。 */
export function validateRecord(model: CompiledModel, record: Readonly<ModelRecord>): void {
  for (const field of model.validation.fields.values()) {
    if (field.key === "createdAt" || field.key === "updatedAt") continue;
    validateValue(
      model.schema,
      effectiveFieldSchema(field),
      record[field.key],
      field.key,
      field.required === true,
    );
  }
}

export function immutable(record: ModelRecord): Readonly<ModelRecord> {
  return Object.freeze({ ...record });
}
