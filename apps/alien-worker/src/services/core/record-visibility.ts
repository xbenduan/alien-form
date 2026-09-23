import type { AlienSchema, ModelRecord } from "@alien-form/protocol";

/** 按协议抹除服务端私有字段，且不修改原记录。 */
export function publicRecord(schema: AlienSchema, record: ModelRecord): ModelRecord {
  const privateFields = schema.fields.filter((field) => field.private).map((field) => field.key);
  if (privateFields.length === 0) return record;
  const result = { ...record };
  for (const field of privateFields) delete result[field];
  return result;
}
