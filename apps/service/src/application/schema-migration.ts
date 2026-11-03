import { escapePointer, resolveFieldSchema, resolveModel, validateValue } from "formwork/model";
import type { CompiledDefinition, DataSchema, FieldSchema, ValidationReport } from "formwork/model";
import type { StoredModel } from "../contracts";
import { bindingKey, quote } from "../adapters/d1/compiler/storage";
import { storedDefinition } from "../adapters/d1/repositories/models";
import { modelContract } from "../../../../packages/domain-contracts";

/** 检查结构及引用迁移；退役根字段保留存储，嵌套变化不能静默改变已有 JSON。 */
export async function schemaMigrationReport(
  db: D1Database,
  previous: StoredModel,
  next: CompiledDefinition,
): Promise<ValidationReport> {
  const errors: ValidationReport["errors"][number][] = [];
  const runtimeChecks: ValidationReport["runtimeChecks"][number][] = [];
  const add = (path: string, message: string) =>
    errors.push({ path, code: "MIGRATION_REQUIRED", message });
  const hasRecords = !!(await db
    .prepare(`SELECT 1 FROM ${quote(previous.manifest.table)} LIMIT 1`)
    .first());
  const resolved = resolveModel(next.schema, modelContract(next.schema));
  const valueShape = (schema: DataSchema): unknown => {
    const {
      title: _title,
      description: _description,
      default: _default,
      readOnly: _readOnly,
      ...shape
    } = schema;
    return {
      ...shape,
      ...("properties" in schema
        ? {
            properties: Object.fromEntries(
              Object.entries(schema.properties).map(([key, field]) => [key, valueShape(field)]),
            ),
          }
        : {}),
      ...("items" in schema ? { items: valueShape(schema.items) } : {}),
      ...("additionalProperties" in schema && schema.additionalProperties
        ? { additionalProperties: valueShape(schema.additionalProperties) }
        : {}),
    };
  };
  const compatible = (before: DataSchema, after: DataSchema): boolean => {
    const signature = (schema: DataSchema) => JSON.stringify(valueShape(schema));
    return signature(before) === signature(after);
  };
  const nested = (before: FieldSchema, after: FieldSchema, path: string) => {
    const oldField = resolveFieldSchema(before, previous.definition.schema);
    const newField = resolveFieldSchema(after, next.schema);
    for (const [key, child] of Object.entries(oldField.properties ?? {})) {
      const candidate = child.id
        ? Object.entries(newField.properties ?? {}).find(([, item]) => item.id === child.id)
        : newField.properties?.[key]
          ? ([key, newField.properties[key]] as const)
          : undefined;
      if (!candidate || candidate[0] !== key)
        add(
          `${path}/properties/${escapePointer(key)}`,
          "嵌套字段删除、改名或身份变化需要显式迁移 JSON 数据",
        );
      else nested(child, candidate[1], `${path}/properties/${escapePointer(key)}`);
    }
    if (oldField.items && newField.items) nested(oldField.items, newField.items, `${path}/items`);
  };
  for (const oldBinding of previous.definition.backend.storage.bindings) {
    const binding = next.backend.storage.bindings.find((item) => item.id === oldBinding.id);
    const oldKey = bindingKey(oldBinding);
    if (!binding) {
      runtimeChecks.push({
        path: `/data/${escapePointer(oldKey)}`,
        code: "FIELD_RETIRED",
        message: "根字段已停用，原物理数据继续保留；恢复时请复用原字段 id",
      });
      continue;
    }
    const key = bindingKey(binding);
    const before = previous.definition.document.data.properties[oldKey]!;
    const after = next.document.data.properties[key]!;
    const source = previous.definition.schema.data[oldKey];
    const target = next.schema.data[key];
    if (source && target) nested(source, target, `/data/${escapePointer(key)}`);
    if (
      hasRecords &&
      next.document.data.required?.includes(key) &&
      !previous.definition.document.data.required?.includes(oldKey)
    )
      add(`/data/${escapePointer(key)}/required`, "收紧 required 需要先补齐并校验存量数据");
    if (hasRecords && !compatible(before, after))
      add(`/data/${escapePointer(key)}`, "已有记录的值契约发生变化，请先显式迁移并校验存量数据");
    if (
      source &&
      target &&
      source.format !== target.format &&
      resolved.field(binding.path).validateFormat &&
      hasRecords
    )
      add(`/data/${escapePointer(key)}/format`, "format 的实际值契约改变，需要校验并迁移存量数据");
  }
  for (const binding of next.backend.storage.bindings) {
    if (previous.definition.backend.storage.bindings.some((item) => item.id === binding.id))
      continue;
    if (hasRecords && next.schema.data[bindingKey(binding)]?.required)
      add(
        `/data/${escapePointer(bindingKey(binding))}`,
        "新增 required 字段需要为存量记录补齐值；default 仅应用于创建",
      );
  }
  const rows = (
    await db
      .prepare(`SELECT v.definition_json FROM fw_models m JOIN fw_model_versions v
    ON m.id = v.model_id AND m.active_version = v.version WHERE m.id <> ?`)
      .bind(next.schema.id)
      .all<{ definition_json: string }>()
  ).results;
  for (const row of rows) {
    const source = storedDefinition(row.definition_json);
    for (const relation of source.backend.relations.filter(
      (item) => item.targetModel === next.schema.id,
    )) {
      const target = next.backend.storage.bindings.find(
        (item) => item.id === relation.targetFieldId,
      );
      const label = next.backend.storage.bindings.find((item) => item.path === relation.labelField);
      if (
        !target ||
        target.path !== relation.valueField ||
        (target.path !== "/id" && target.index !== "unique") ||
        !label
      )
        add(
          "/data",
          `模型 ${source.schema.id} 的关系目标地址或唯一性失效，需要联合迁移相关 Schema`,
        );
    }
  }
  // A new schema is validated independently of existing values; absence of data does not
  // make an invalid default or format valid.
  for (const field of resolved.fields) {
    if (field.schema.default === undefined) continue;
    for (const issue of validateValue(field.valueSchema, field.schema.default))
      add(`/data${field.path}/default`, issue.message);
  }
  return { errors, runtimeChecks };
}
