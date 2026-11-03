import { escapePointer, isObject } from "./pointer";
import { resolveModel } from "./field";
import type { FieldContract } from "./field";
import type {
  CompiledDefinition,
  DraftDefinition,
  FieldSchema,
  ModelDefinition,
  StorageBinding,
} from "./types";

/** 返回服务端管理的记录身份字段，作者可以只补充标题与展示。 */
export const identityFields: Readonly<Record<string, FieldSchema>> = {
  id: { type: "string", readOnly: true, title: "ID" },
  createdAt: { type: "string", readOnly: true, title: "创建时间" },
  updatedAt: { type: "string", readOnly: true, title: "更新时间" },
  creatorId: { type: "string", readOnly: true, title: "创建者" },
};
const identityColumns: Record<string, string> = {
  id: "id",
  createdAt: "created_at",
  updatedAt: "updated_at",
  creatorId: "creator_id",
};

/** 首次保存时补齐字段稳定身份，后续同路径草稿保留已有身份。 */
export function assignFieldIds(
  draft: DraftDefinition,
  previous?: DraftDefinition,
): DraftDefinition {
  const result = structuredClone(draft);
  const visit = (value: unknown, before: unknown) => {
    if (!isObject(value)) return;
    if (typeof value.id !== "string")
      value.id =
        isObject(before) && typeof before.id === "string" ? before.id : crypto.randomUUID();
    if (isObject(value.properties))
      for (const [key, field] of Object.entries(value.properties))
        visit(
          field,
          isObject(before) && isObject(before.properties) ? before.properties[key] : undefined,
        );
    if (isObject(value.items)) visit(value.items, isObject(before) ? before.items : undefined);
  };
  if (isObject(result.data))
    for (const [key, field] of Object.entries(result.data)) {
      if (identityColumns[key] && isObject(field) && field.id === undefined)
        field.id =
          isObject(previous?.data) &&
          isObject(previous.data[key]) &&
          typeof previous.data[key].id === "string"
            ? previous.data[key].id
            : key;
      visit(field, isObject(previous?.data) ? previous.data[key] : undefined);
    }
  return result;
}
/** 从一份作者 Schema 生成校验、稳定存储和关系计划，不执行数据库操作。 */
export function compileDefinition(
  schema: ModelDefinition,
  contract: FieldContract = {},
  previous?: CompiledDefinition,
): CompiledDefinition {
  const data = { ...identityFields, ...schema.data };
  const model = resolveModel({ ...schema, data }, contract);
  const bindings: StorageBinding[] = model.fields.map((field) => {
    const key = field.path.slice(1).replaceAll("~1", "/").replaceAll("~0", "~");
    const source = field.schema;
    const id = source.id ?? (identityColumns[key] ? key : `${schema.id}:${key}`);
    const before = previous?.backend.storage.bindings.find((binding) => binding.id === id);
    const storage = source.storage;
    const type = source.type;
    return {
      id,
      path: field.path,
      ...(identityColumns[key]
        ? { column: identityColumns[key] }
        : storage?.column
          ? { column: storage.column }
          : storage?.jsonKey
            ? { jsonKey: storage.jsonKey }
            : before
              ? before.column
                ? { column: before.column }
                : { jsonKey: before.jsonKey }
              : { jsonKey: id }),
      sqlType:
        type === "boolean" || type === "integer" ? "INTEGER" : type === "number" ? "REAL" : "TEXT",
      encoding: type === "array" || type === "object" ? "json" : "scalar",
      ...(storage?.index ? { index: storage.index } : {}),
    };
  });
  const document = {
    schemaVersion: schema.schemaVersion,
    id: schema.id,
    title: schema.title,
    ...(schema.domain ? { domain: schema.domain } : {}),
    ...(schema.tree ? { tree: schema.tree } : {}),
    data: model.valueSchema,
  };
  return {
    schema,
    document,
    backend: {
      storage: {
        table:
          schema.backend?.storage?.table ??
          previous?.backend.storage.table ??
          `data_${schema.id.replaceAll("_", "__").replaceAll("-", "_d")}`,
        bindings,
      },
      relations: model.fields.flatMap((field) => {
        const relation = field.schema.relation;
        if (!relation) return [];
        const valueField = relation.valueField ?? "/id";
        return [
          {
            fieldId: bindings.find((binding) => binding.path === field.path)!.id,
            targetModel: relation.model,
            targetFieldId: valueField === "/id" ? "id" : valueField,
            valueField,
            labelField: relation.labelField ?? "/name",
            kind:
              field.schema.type === "array" ? ("many-to-many" as const) : ("many-to-one" as const),
            ...(field.schema.storage?.through ? { through: field.schema.storage.through } : {}),
          },
        ];
      }),
      permissions: schema.backend?.permissions ?? { grants: [], privateFields: [] },
      behavior: {
        rules: schema.backend?.behavior?.rules ?? [],
        commands: schema.backend?.behavior?.commands ?? {},
        events: schema.backend?.behavior?.events ?? {},
      },
    },
  };
}

/** 将编译身份字段投影回同一字段协议，供客户端获得全部返回字段。 */
export function runtimeDocument(definition: CompiledDefinition): ModelDefinition {
  const { backend: _backend, ...schema } = definition.schema;
  return { ...schema, data: { ...identityFields, ...schema.data } };
}

/** 将字段名称编码为作者 Schema 中的诊断地址。 */
export function fieldLocation(key: string): string {
  return `/data/${escapePointer(key)}`;
}
