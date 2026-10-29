import type { JsonValue, RecordValue, StorageBinding } from "formwork/model";
import { isObject } from "formwork/model";
import type { StoredModel } from "../../../contracts";
import { bindingKey, quote } from "../compiler/storage";

/** 表示包含物理列及保留 JSON 内容的 D1 行。 */
export type PhysicalRow = Record<string, string | number | null> & {
  id: string;
  created_at: string;
  updated_at: string;
  creator_id: string;
  data_content: string;
};
/** 将单个值编码为绑定参数，布尔值在 SQLite 中使用整数。 */
export function encodeValue(
  binding: StorageBinding,
  value: JsonValue | undefined,
): string | number | null {
  if (value === undefined || value === null) return null;
  if (binding.encoding === "json") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  return value as string | number;
}
/** 解码当前活动字段，保留物理历史列而不将它们暴露为业务值。 */
export function decodeRow(model: StoredModel, row: PhysicalRow): RecordValue {
  const content = JSON.parse(row.data_content || "{}") as Record<string, JsonValue>;
  const result: RecordValue = {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    creatorId: row.creator_id,
  };
  for (const binding of model.definition.backend.storage.bindings) {
    const key = bindingKey(binding);
    const raw = binding.column ? row[binding.column] : content[binding.jsonKey!];
    if (raw === undefined || raw === null) {
      const schema = model.definition.document.data.properties[key];
      if (schema && "type" in schema && (schema.type === "null" || Array.isArray(schema.type)))
        result[key] = null;
      continue;
    }
    let value: JsonValue =
      binding.encoding === "json" && binding.column ? (JSON.parse(String(raw)) as JsonValue) : raw;
    const schema = model.definition.document.data.properties[key];
    if (
      schema &&
      "type" in schema &&
      (schema.type === "boolean" || (Array.isArray(schema.type) && schema.type[0] === "boolean"))
    )
      value = value === 1 || value === true;
    result[key] = value;
  }
  return result;
}
/** 读取可信服务所需的物理行，id 始终使用绑定参数。 */
export function readRow(
  db: D1Database,
  model: StoredModel,
  id: string,
): Promise<PhysicalRow | null> {
  return db
    .prepare(`SELECT * FROM ${quote(model.manifest.table)} WHERE id = ?`)
    .bind(id)
    .first<PhysicalRow>();
}
/** 从当前活动 through 表补齐关系数组，不查询已停用的关系。 */
export async function withRelations(
  db: D1Database,
  model: StoredModel,
  row: PhysicalRow,
): Promise<RecordValue> {
  const record = decodeRow(model, row);
  for (const relation of model.manifest.relations) {
    if (!relation.active || !relation.table) continue;
    const binding = model.definition.backend.storage.bindings.find(
      (item) => item.id === relation.fieldId,
    )!;
    record[bindingKey(binding)] = (
      await db
        .prepare(
          `SELECT target_value FROM ${quote(relation.table)} WHERE source_id = ? ORDER BY target_value`,
        )
        .bind(row.id)
        .all<{ target_value: string }>()
    ).results.map((item) => item.target_value);
  }
  return record;
}
/** 合并 JSON 内容时保留已停用或未知的历史键。 */
export function mergeContent(
  model: StoredModel,
  record: RecordValue,
  previous?: PhysicalRow,
): string {
  const parsed: unknown = JSON.parse(previous?.data_content || "{}");
  const content = isObject(parsed) ? parsed : {};
  for (const binding of model.definition.backend.storage.bindings) {
    if (binding.jsonKey) {
      const key = bindingKey(binding);
      if (Object.hasOwn(record, key)) content[binding.jsonKey] = record[key];
      else delete content[binding.jsonKey];
    }
  }
  return JSON.stringify(content);
}
