import { FormworkError } from "formwork";
import type { FormworkApis, ModelSnapshot, RecordSnapshot } from "formwork/data";
import { pointerSegments } from "formwork/model";

const model: ModelSnapshot = {
  schema: {
    schemaVersion: 1,
    id: "notes",
    title: "便笺",
    data: {
      title: { type: "string", title: "标题", required: true, minLength: 1 },
    },
  },
  schemaRevision: "schema-1",
  capabilities: {
    actions: { read: true, create: true, update: true, delete: true },
    fields: {
      "/title": { read: true, create: true, update: true, filter: ["contains"], sort: true },
    },
  },
};
const records = new Map<string, RecordSnapshot>();
const get = (id: string) => {
  const record = records.get(id);
  if (!record) throw new FormworkError("NOT_FOUND", "便笺不存在");
  return structuredClone(record);
};
function condition(input: {
  modelId: string;
  ifSchemaRevision?: string;
  recordId?: string;
  ifRecordRevision?: string;
}) {
  if (input.modelId !== model.schema.id) throw new FormworkError("NOT_FOUND", "模型不存在");
  if (input.ifSchemaRevision !== undefined && input.ifSchemaRevision !== model.schemaRevision)
    throw new FormworkError("SCHEMA_CONFLICT", "模型已更新");
  if (
    input.ifRecordRevision !== undefined &&
    get(input.recordId!).revision !== input.ifRecordRevision
  )
    throw new FormworkError("RECORD_CONFLICT", "记录已被修改");
}
function save(id: string, data: RecordSnapshot["data"]) {
  if (typeof data.title !== "string" || !data.title.trim())
    throw new FormworkError("INVALID_VALUE", "请填写标题");
  const record = {
    id,
    data: structuredClone(data),
    revision: crypto.randomUUID(),
    schemaRevision: model.schemaRevision,
  };
  records.set(id, record);
  return structuredClone(record);
}

/** 提供可替换成 HTTP 或其他数据服务的内存 API；刷新浏览器后清空。 */
export const apis: FormworkApis = {
  models: {
    async get(input) {
      condition(input);
      return structuredClone(model);
    },
  },
  records: {
    async get(input) {
      condition(input);
      return get(input.recordId);
    },
    async query(input) {
      condition(input);
      const { query } = input;
      const rows = [...records.values()].filter((record) =>
        query.clauses.every(
          (clause) =>
            clause.field === "/title" &&
            clause.operator === "contains" &&
            String(record.data.title).includes(String(clause.operand)),
        ),
      );
      rows.sort(
        (a, b) =>
          String(a.data.title).localeCompare(String(b.data.title)) *
          (query.sort?.direction === "desc" ? -1 : 1),
      );
      const offset = (query.page - 1) * query.pageSize;
      return {
        items: structuredClone(rows.slice(offset, offset + query.pageSize)),
        total: rows.length,
      };
    },
    async create(input) {
      condition(input);
      return save(crypto.randomUUID(), input.data);
    },
    async update(input) {
      condition(input);
      const data = { ...get(input.recordId).data, ...input.changes.set };
      for (const path of input.changes.unset ?? []) delete data[pointerSegments(path)[0]!];
      return save(input.recordId, data);
    },
    async delete(input) {
      condition(input);
      get(input.recordId);
      records.delete(input.recordId);
      return { id: input.recordId, deleted: true };
    },
  },
};
