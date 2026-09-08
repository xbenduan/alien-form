import {
  modelSchemaSchema,
  type DatabaseValueType,
  type ModelFieldSchema,
  type ModelSchema,
} from "./model-schema.ts";
import type { FieldSchema } from "./field-schema.ts";

const SYSTEM_FIELDS = new Set(["id", "createdAt", "updatedAt"]);

function fieldValueType(field: ModelFieldSchema): DatabaseValueType {
  const database = field.database;
  if (!database) {
    if (field.form.type === "number") return "number";
    if (field.form.type === "boolean") return "boolean";
    if (field.form.type === "object") return "object";
    if (field.form.type === "array") return "array";
    return "string";
  }
  if (database.valueType) return database.valueType;
  if (database.type === "integer" || database.type === "real") return "number";
  if (database.type === "boolean") return "boolean";
  if (database.type === "json") return "object";
  return "string";
}

function formatValue(value: unknown): string {
  return value === undefined ? "未配置" : JSON.stringify(value);
}

function assertRelationForm(field: ModelFieldSchema): void {
  const relation = field.relation;
  if (!relation) return;
  const path = `fields.${field.key}.form`;
  const expectedValueField = relation.valueField ?? "id";
  const expectedLabelField = relation.labelField ?? "name";
  const props = field.form.props;

  if (field.form.component !== "RemoteSelect") {
    throw new Error(`${path}.component 必须为 "RemoteSelect"`);
  }
  if (!props || typeof props !== "object" || Array.isArray(props)) {
    throw new Error(`${path}.props 必须包含关联配置`);
  }
  if (props.model !== relation.target) {
    throw new Error(
      `${path}.props.model 必须为 ${JSON.stringify(relation.target)}，实际 ${formatValue(props.model)}`,
    );
  }
  if (props.valueField !== expectedValueField) {
    throw new Error(
      `${path}.props.valueField 必须为 ${JSON.stringify(expectedValueField)}，实际 ${formatValue(props.valueField)}`,
    );
  }
  if (props.labelField !== expectedLabelField) {
    throw new Error(
      `${path}.props.labelField 必须为 ${JSON.stringify(expectedLabelField)}，实际 ${formatValue(props.labelField)}`,
    );
  }
}

function assertPageGroups(schema: ModelSchema): void {
  const fieldKeys = new Set(schema.fields.map((field) => field.key));
  for (const page of schema.pages) {
    const assigned = new Set<string>();
    for (const group of page.groups ?? []) {
      for (const key of group.keys) {
        if (!fieldKeys.has(key)) {
          throw new Error(`页面 ${page.router} 的 groups 引用了不存在的字段：${key}`);
        }
        if (assigned.has(key)) {
          throw new Error(`页面 ${page.router} 的 groups 字段重复：${key}`);
        }
        assigned.add(key);
      }
    }
  }
}

function assertDefinitions(schema: ModelSchema): void {
  if (schema.definitions?.["form-schema"]) {
    throw new Error('definitions 不允许声明 "form-schema"，该定义由前端运行时派生');
  }
}

export function assertModelSchema(value: unknown): asserts value is ModelSchema {
  const parsed = modelSchemaSchema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join(".");
    throw new Error(`模型定义不合法${path ? `（${path}）` : ""}：${first?.message ?? "unknown"}`);
  }
  const schema = parsed.data as ModelSchema;
  const ids = new Set<string>();
  const keys = new Set<string>();

  for (const field of schema.fields) {
    if (ids.has(field.id)) throw new Error(`字段 id 重复：${field.id}`);
    if (keys.has(field.key)) throw new Error(`字段 key 重复：${field.key}`);
    ids.add(field.id);
    keys.add(field.key);

    if (field.storage === "physical" && !field.database) {
      throw new Error(`physical 字段 ${field.key} 必须配置 database`);
    }
    if (field.storage === "virtual" && field.database) {
      throw new Error(`virtual 字段 ${field.key} 不允许配置 database`);
    }
    if (
      field.database &&
      field.database.type !== "json" &&
      (field.database.valueType === "object" || field.database.valueType === "array")
    ) {
      throw new Error(`字段 ${field.key} 只有 json 物理类型可使用 object/array valueType`);
    }
    if (field.storage === "physical" && field.form.type !== fieldValueType(field)) {
      throw new Error(`字段 ${field.key} 的 form.type 与 database 类型不一致`);
    }
    if (
      field.storage === "physical" &&
      field.database?.system !== true &&
      Boolean(field.form.required) !== (field.database?.nullable === false)
    ) {
      throw new Error(`字段 ${field.key} 的 form.required 与 database.nullable 不一致`);
    }
    assertRelationForm(field);
  }

  for (const key of SYSTEM_FIELDS) {
    const field = schema.fields.find((item) => item.key === key);
    if (!field || field.storage !== "physical" || field.database?.system !== true) {
      throw new Error(`系统字段 ${key} 必须声明为 physical 且 database.system=true`);
    }
  }

  assertDefinitions(schema);
  assertPageGroups(schema);
}

export function parseModelSchema(value: unknown): ModelSchema {
  const parsed = modelSchemaSchema.parse(value) as ModelSchema;
  assertModelSchema(parsed);
  return parsed;
}

export function isModelSchema(value: unknown): value is ModelSchema {
  try {
    assertModelSchema(value);
    return true;
  } catch {
    return false;
  }
}

export function modelFormProperties(schema: ModelSchema): Record<string, FieldSchema> {
  return Object.fromEntries(schema.fields.map((field) => [field.key, field.form]));
}

export function physicalFields(schema: ModelSchema): ModelFieldSchema[] {
  return schema.fields.filter((field) => field.storage === "physical");
}

export function valueType(field: ModelFieldSchema): DatabaseValueType {
  return fieldValueType(field);
}

export function assertStorageCompatible(current: ModelSchema, incoming: ModelSchema): void {
  if (current.name !== incoming.name) throw new Error("模型 name 不允许修改");
  const incomingById = new Map(incoming.fields.map((field) => [field.id, field]));

  for (const field of current.fields) {
    if (field.storage !== "physical") continue;
    const next = incomingById.get(field.id);
    if (!next) throw new Error(`物理字段不允许删除：${field.key}`);
    if (next.storage !== "physical") throw new Error(`物理字段不允许转为 virtual：${field.key}`);
    if (next.key !== field.key) throw new Error(`物理字段 key 不允许修改：${field.key}`);
    if (next.database?.column !== field.database?.column) {
      throw new Error(`物理字段 column 不允许修改：${field.key}`);
    }
    if (next.database?.type !== field.database?.type) {
      throw new Error(`物理字段类型不允许修改：${field.key}`);
    }
    if (next.database?.valueType !== field.database?.valueType) {
      throw new Error(`物理字段 valueType 不允许修改：${field.key}`);
    }
    if (next.database?.nullable !== field.database?.nullable) {
      throw new Error(`物理字段 nullable 不允许修改：${field.key}`);
    }
    if (next.database?.default !== field.database?.default) {
      throw new Error(`物理字段 default 不允许修改：${field.key}`);
    }
    if (JSON.stringify(next.relation) !== JSON.stringify(field.relation)) {
      throw new Error(`物理字段 relation 不允许修改：${field.key}`);
    }
    if (field.database?.index && !next.database?.index) {
      throw new Error(`物理字段索引不允许移除：${field.key}`);
    }
    if (field.database?.unique && !next.database?.unique) {
      throw new Error(`物理字段唯一索引不允许移除：${field.key}`);
    }
  }
}
