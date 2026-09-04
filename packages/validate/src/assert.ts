import {
  builderSchemaSchema,
  type BuilderSchema,
  type DatabaseField,
  type DatabaseValueType,
} from "./builder-schema.ts";
import type { FieldSchema } from "./field-schema.ts";

export function formProperties(schema: BuilderSchema): Record<string, FieldSchema> {
  const properties = schema.definitions?.["form-schema"]?.properties;
  if (!properties || Object.keys(properties).length === 0) {
    throw new Error("definitions['form-schema'].properties 不能为空");
  }
  return properties;
}

export function databaseFields(schema: BuilderSchema): DatabaseField[] {
  const fields = schema.fields;
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error("fields 不能为空");
  }
  return fields;
}

/** 由物理列类型推导应用层值类型。 */
export function valueType(field: DatabaseField): DatabaseValueType {
  if (field.valueType) return field.valueType;
  if (field.type === "integer" || field.type === "real") return "number";
  if (field.type === "boolean") return "boolean";
  if (field.type === "json") return "object";
  return "string";
}

/**
 * 深度校验：结构（zod）+ 协议约束（fields 唯一键、form-schema ⊇ fields 一致性、
 * group、禁止 x-database）。抛错即不合法。
 */
export function assertBuilderSchema(value: unknown): asserts value is BuilderSchema {
  const parsed = builderSchemaSchema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join(".");
    throw new Error(`模型定义不合法${path ? `（${path}）` : ""}：${first?.message ?? "unknown"}`);
  }
  const schema = parsed.data as unknown as BuilderSchema;

  const properties = formProperties(schema);
  const fields = databaseFields(schema);

  // fields 唯一键
  const seenKeys = new Set<string>();
  for (const field of fields) {
    if (seenKeys.has(field.key)) throw new Error(`fields 字段名重复：${field.key}`);
    seenKeys.add(field.key);
    if (field.type !== "json" && (field.valueType === "object" || field.valueType === "array")) {
      throw new Error(`fields.${field.key} 只有 json 类型可用 object/array valueType`);
    }
  }

  // form-schema ⊇ fields：覆盖每个 key；额外 key 只允许 type:"void" 纯展示元素。
  const propertyKeys = Object.keys(properties);
  const missing = [...seenKeys].filter((key) => !properties[key]);
  const extra = propertyKeys.filter(
    (key) => !seenKeys.has(key) && properties[key]?.type !== "void",
  );
  if (missing.length > 0) throw new Error(`form-schema 缺少数据库字段：${missing.join(", ")}`);
  if (extra.length > 0) throw new Error(`form-schema 包含非数据库字段：${extra.join(", ")}`);

  // 落库字段 type / required 与 fields 一致
  for (const field of fields) {
    const prop = properties[field.key];
    if (prop?.type !== valueType(field)) {
      throw new Error(`form-schema 字段 ${field.key} 的 type 与 fields 不一致`);
    }
    if (Boolean(prop?.required) !== (field.nullable === false)) {
      throw new Error(`form-schema 字段 ${field.key} 的 required 与 fields 不一致`);
    }
  }

  // group 引用校验
  const formSchema = schema.definitions["form-schema"];
  const groups = formSchema.group ?? [];
  const assigned = new Set<string>();
  for (const [index, group] of groups.entries()) {
    if (!Array.isArray(group.keys)) throw new Error(`form-schema.group[${index}].keys 必须是数组`);
    for (const key of group.keys) {
      if (!properties[key]) throw new Error(`form-schema.group 引用了不存在的字段：${key}`);
      if (assigned.has(key)) throw new Error(`form-schema.group 字段重复：${key}`);
      assigned.add(key);
    }
  }

  // 存储定义只能来自 fields，form-schema 不接受旧版 x-database。
  const visit = (current: unknown, path: string): void => {
    if (!current || typeof current !== "object") return;
    for (const [key, child] of Object.entries(current)) {
      if (key === "x-database") throw new Error(`${path} 不允许包含 x-database`);
      visit(child, `${path}.${key}`);
    }
  };
  visit(formSchema, "definitions.form-schema");
}

/** 解析并返回强类型 BuilderSchema（校验失败抛错）。 */
export function parseBuilderSchema(value: unknown): BuilderSchema {
  assertBuilderSchema(value);
  return value;
}
