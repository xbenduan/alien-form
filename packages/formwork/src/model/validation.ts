import { FormworkError } from "./errors";
import { cloneJson, escapePointer, isObject, pointerSegments } from "./pointer";
import type { DataSchema, JsonValue, ModelDocument, ValidationIssue } from "./types";

/** 解析根 data.$defs 下的本地引用，保留引用处的元信息覆盖。 */
export function resolveSchema(schema: DataSchema, root: DataSchema): DataSchema {
  const seen = new Set<string>();
  while ("$ref" in schema) {
    const ref = schema.$ref;
    if (seen.has(ref)) throw new FormworkError("INVALID_MODEL", `循环引用 ${ref}`);
    seen.add(ref);
    const parts = pointerSegments(ref.startsWith("#") ? ref.slice(1) : ref);
    if (!ref.startsWith("#/$defs/") || parts.length !== 2)
      throw new FormworkError("INVALID_MODEL", `仅支持 #/$defs/name 引用: ${ref}`);
    const defs = (root as ModelDocument["data"]).$defs;
    if (!defs || !Object.hasOwn(defs, parts[1]!))
      throw new FormworkError("INVALID_MODEL", `不存在的引用 ${ref}`);
    const { $ref: _ref, ...metadata } = schema;
    const target = defs[parts[1]!]!;
    schema = {
      ...target,
      ...metadata,
      readOnly: !!target.readOnly || !!metadata.readOnly,
    } as DataSchema;
  }
  return schema;
}

/** 返回 schema 的主类型，可空标量仍按其非 null 类型处理。 */
export function schemaType(schema: DataSchema): string {
  return "$ref" in schema
    ? "$ref"
    : Array.isArray(schema.type)
      ? schema.type[0]!
      : (schema.type as string);
}

/** 在 schema 中定位 Pointer 并汇总沿途只读约束。 */
export function schemaAt(
  root: DataSchema,
  pointer: string,
  referenceRoot: DataSchema = root,
): { schema: DataSchema; readOnly: boolean; required: boolean } {
  let schema = resolveSchema(root, referenceRoot);
  let readOnly = !!schema.readOnly;
  let required = false;
  for (const part of pointerSegments(pointer)) {
    if (
      schemaType(schema) === "object" &&
      "properties" in schema &&
      Object.hasOwn(schema.properties, part)
    ) {
      required = schema.required?.includes(part) ?? false;
      schema = resolveSchema(schema.properties[part]!, referenceRoot);
    } else if (
      schemaType(schema) === "array" &&
      "items" in schema &&
      /^(0|[1-9]\d*)$/u.test(part)
    ) {
      schema = resolveSchema(schema.items, referenceRoot);
      required = true;
    } else
      throw new FormworkError("UNKNOWN_FIELD", `不存在的字段 ${pointer}`, [
        { path: pointer, code: "UNKNOWN_FIELD", message: "字段未在 schema 中声明" },
      ]);
    readOnly ||= !!schema.readOnly;
  }
  return { schema, readOnly, required };
}

/** 按 DataSchema 检查值，缺失的可选属性不会触发其字段约束。 */
export function validateValue(
  schema: DataSchema,
  value: unknown,
  root: DataSchema = schema,
  path = "",
): ValidationIssue[] {
  schema = resolveSchema(schema, root);
  const issues: ValidationIssue[] = [];
  const add = (code: string, message: string, location = path) =>
    issues.push({ path: location, code, message });
  if (value === undefined) return issues;
  const type = schemaType(schema);
  if (
    value === null &&
    "type" in schema &&
    (schema.type === "null" || Array.isArray(schema.type))
  ) {
    if ("enum" in schema && schema.enum && !schema.enum.includes(null))
      add("ENUM", "值不在 enum 中");
    return issues;
  }
  const validType =
    type === "object"
      ? isObject(value)
      : type === "array"
        ? Array.isArray(value)
        : type === "integer"
          ? typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)
          : type === "number"
            ? typeof value === "number" && Number.isFinite(value)
            : typeof value === type;
  if (!validType) {
    add("TYPE", `需要 ${type} 类型`);
    return issues;
  }
  if ("enum" in schema && schema.enum && !schema.enum.some((item) => item === value))
    add("ENUM", "值不在 enum 中");
  if (typeof value === "string" && "type" in schema && schemaType(schema) === "string") {
    const rule = schema as DataSchema & {
      minLength?: number;
      maxLength?: number;
      pattern?: string;
    };
    const length = [...value].length;
    if (rule.minLength !== undefined && length < rule.minLength)
      add("MIN_LENGTH", `至少 ${rule.minLength} 个字符`);
    if (rule.maxLength !== undefined && length > rule.maxLength)
      add("MAX_LENGTH", `至多 ${rule.maxLength} 个字符`);
    if (rule.pattern !== undefined && !new RegExp(rule.pattern, "u").test(value))
      add("PATTERN", "值不符合 pattern");
  }
  if (typeof value === "number") {
    const rule = schema as DataSchema & { minimum?: number; maximum?: number };
    if (rule.minimum !== undefined && value < rule.minimum)
      add("MINIMUM", `不得小于 ${rule.minimum}`);
    if (rule.maximum !== undefined && value > rule.maximum)
      add("MAXIMUM", `不得大于 ${rule.maximum}`);
  }
  if (isObject(value) && "properties" in schema) {
    for (const key of schema.required ?? [])
      if (!Object.hasOwn(value, key)) add("REQUIRED", "必填字段", `${path}/${escapePointer(key)}`);
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}/${escapePointer(key)}`;
      if (!Object.hasOwn(schema.properties, key)) add("UNKNOWN_FIELD", "未声明的字段", childPath);
      else issues.push(...validateValue(schema.properties[key]!, child, root, childPath));
    }
  }
  if (Array.isArray(value) && "items" in schema) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      add("MIN_ITEMS", `至少 ${schema.minItems} 项`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      add("MAX_ITEMS", `至多 ${schema.maxItems} 项`);
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index) || value[index] === undefined)
        add("INVALID_VALUE", "数组项不能缺失", `${path}/${index}`);
      else issues.push(...validateValue(schema.items, value[index], root, `${path}/${index}`));
    }
  }
  return issues;
}

/** 补入缺失 default，并复制输入；显式 null、false、0 和空串不会覆盖。 */
export function applyDefaults(
  schema: DataSchema,
  value?: JsonValue,
  root: DataSchema = schema,
): JsonValue | undefined {
  schema = resolveSchema(schema, root);
  if (value === undefined && Object.hasOwn(schema, "default")) value = cloneJson(schema.default);
  if (
    schemaType(schema) === "object" &&
    "properties" in schema &&
    (value === undefined || isObject(value))
  ) {
    const result: Record<string, JsonValue> =
      value === undefined ? {} : (cloneJson(value) as Record<string, JsonValue>);
    for (const [key, child] of Object.entries(schema.properties)) {
      const next = applyDefaults(child, Object.hasOwn(result, key) ? result[key] : undefined, root);
      if (next !== undefined)
        Object.defineProperty(result, key, {
          value: next,
          writable: true,
          enumerable: true,
          configurable: true,
        });
    }
    return value === undefined && Object.keys(result).length === 0 ? undefined : result;
  }
  if (Array.isArray(value) && "items" in schema)
    return value.map((item) => applyDefaults(schema.items, item, root) ?? item);
  return cloneJson(value);
}
