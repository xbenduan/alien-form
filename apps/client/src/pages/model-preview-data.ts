import { FormworkError } from "formwork";
import {
  checkAbort,
  cloneJson,
  createFormworkApi,
  resolveSchema,
  schemaType,
} from "formwork/model";
import type { DataSchema, FormworkApi, JsonValue, ModelDocument, RecordValue } from "formwork/model";

const sampleRecord = (document: ModelDocument, index: number): RecordValue => {
  let remaining = 500;
  const sample = (input: DataSchema, name: string, depth = 0): JsonValue => {
    if (depth > 12 || --remaining < 0) return null;
    const schema = resolveSchema(input, document.data);
    if (schema.default !== undefined) return cloneJson(schema.default);
    if ("enum" in schema && schema.enum?.length)
      return schema.enum[index % schema.enum.length]!;
    if ("type" in schema && Array.isArray(schema.type) && index === 2) return null;
    if ("properties" in schema)
      return Object.fromEntries(
        Object.entries(schema.properties).map(([key, child]) => [
          key,
          sample(child, key, depth + 1),
        ]),
      );
    if ("items" in schema)
      return Array.from(
        { length: Math.min(20, schema.maxItems ?? 20, Math.max(1, schema.minItems ?? 0)) },
        () => sample(schema.items, name, depth + 1),
      );
    if (schemaType(schema) === "boolean") return index % 2 === 0;
    if ("type" in schema && ["number", "integer"].includes(schemaType(schema))) {
      const numeric = schema as DataSchema & { minimum?: number; maximum?: number };
      return Math.min(numeric.maximum ?? Infinity, Math.max(numeric.minimum ?? 0, (index + 1) * 100));
    }
    if (schemaType(schema) === "string") {
      const text = schema as DataSchema & { minLength?: number; maxLength?: number };
      return `${schema.title ?? name} ${index + 1}`
        .padEnd(Math.min(text.minLength ?? 0, 512), "示")
        .slice(0, text.maxLength ?? 512);
    }
    return null;
  };
  return { ...(sample(document.data, document.title) as RecordValue), id: `preview-${index + 1}` };
};

/** 从 Schema 生成临时记录并提供本地 CRUD；未实现的能力也不会发出网络请求。 */
export function createPreviewApi(document: ModelDocument): FormworkApi {
  const records = new Map(
    Array.from({ length: 3 }, (_, index) => {
      const record = sampleRecord(document, index);
      return [record.id as string, record] as const;
    }),
  );
  const assertModel = (id: string, signal?: AbortSignal) => {
    checkAbort(signal);
    if (id !== document.id)
      throw new FormworkError("INVALID_MODEL", "预览仅提供当前模型的模拟数据。");
  };
  const read = (id: string): RecordValue => {
    const value = records.get(id);
    if (!value) throw new FormworkError("NOT_FOUND", "模拟记录不存在。");
    return cloneJson(value);
  };
  const api = createFormworkApi({
    url: "/preview",
    fetch: async () => {
      throw new FormworkError("PREVIEW_LOCAL_ONLY", "此操作尚未提供本地预览。");
    },
  });
  return {
    ...api,
    runtime: {
      async schema(id, options) {
        assertModel(id, options?.signal);
        return { schema: structuredClone(document), version: 1, revision: "preview" };
      },
    },
    records: {
      async query(id, query, options) {
        assertModel(id, options?.signal);
        const list = [...records.values()].filter((record) => {
          if (
            query.keyword &&
            !JSON.stringify(record).toLocaleLowerCase().includes(query.keyword.toLocaleLowerCase())
          )
            return false;
          return Object.entries(query.filters).every(([field, value]) =>
            typeof value === "string"
              ? String(record[field] ?? "").toLocaleLowerCase().includes(value.toLocaleLowerCase())
              : JSON.stringify(record[field]) === JSON.stringify(value),
          );
        });
        if (query.sort) {
          const { field, direction } = query.sort;
          list.sort((left, right) => {
            const a = left[field];
            const b = right[field];
            const order =
              typeof a === "number" && typeof b === "number"
                ? a - b
                : String(a ?? "").localeCompare(String(b ?? ""), "zh-CN", { numeric: true });
            return direction === "asc" ? order : -order;
          });
        }
        const offset = (query.page - 1) * query.pageSize;
        return { list: cloneJson(list.slice(offset, offset + query.pageSize)), total: list.length };
      },
      async read(id, recordId, options) {
        assertModel(id, options?.signal);
        return read(recordId);
      },
      async create(id, value, options) {
        assertModel(id, options?.signal);
        const recordId = `preview-${crypto.randomUUID()}`;
        records.set(recordId, { ...cloneJson(value), id: recordId });
        return read(recordId);
      },
      async update(id, recordId, value, options) {
        assertModel(id, options?.signal);
        records.set(recordId, { ...read(recordId), ...cloneJson(value), id: recordId });
        return read(recordId);
      },
      async delete(id, recordId, options) {
        assertModel(id, options?.signal);
        read(recordId);
        records.delete(recordId);
        return { deleted: true };
      },
      async command(id, _command, value, options) {
        assertModel(id, options?.signal);
        return cloneJson(value);
      },
    },
  };
}
