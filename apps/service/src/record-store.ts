import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  cloneJson,
  FormworkError,
  isObject,
  modelIdPattern,
  resolveSchema,
  schemaType,
  validateValue,
} from "formwork/model";
import type { ModelSource } from "formwork/model";
import type { RecordPage, RecordQuery, RecordValue } from "./contracts.js";
import { createSerialQueue, parseStored, readStored, writeStored } from "./storage.js";

/** 保存真实开发记录，id 仅用于定位而不会成为文件路径。 */
export function createRecordStore(dataDir: string, models: ModelSource) {
  const serial = createSerialQueue();
  const directory = (modelId: string) => {
    if (!modelIdPattern.test(modelId)) throw new FormworkError("INVALID_MODEL", "非法模型 id");
    return join(dataDir, "records", modelId);
  };
  const path = (modelId: string, id: string) => {
    if (typeof id !== "string" || !id || id.length > 512)
      throw new FormworkError("INVALID_RECORD", "记录 id 必须是非空字符串，长度至多 512");
    return join(directory(modelId), `${createHash("sha256").update(id).digest("hex")}.json`);
  };
  const read = async (modelId: string, id: string): Promise<RecordValue> => {
    await models.read(modelId);
    const bytes = await readStored(path(modelId, id));
    if (!bytes) throw new FormworkError("NOT_FOUND", `找不到记录 ${id}`);
    const record = parseStored(bytes);
    if (!isObject(record) || record.id !== id)
      throw new FormworkError("INVALID_DATA", "记录文件的 id 不一致");
    return record as RecordValue;
  };
  const validate = async (modelId: string, value: unknown, id: string) => {
    if (!isObject(value)) throw new FormworkError("INVALID_RECORD", "记录必须是普通 JSON object");
    const model = (await models.read(modelId)).document;
    const record = cloneJson({ ...value, id } as RecordValue)!;
    const checked = Object.hasOwn(model.data.properties, "id")
      ? record
      : Object.fromEntries(Object.entries(record).filter(([key]) => key !== "id"));
    const issues = validateValue(model.data, checked, model.data);
    if (issues.length) throw new FormworkError("INVALID_VALUE", "记录不满足远端模型约束", issues);
    return record;
  };
  return {
    read,
    async create(modelId: string, value: unknown): Promise<RecordValue> {
      if (!isObject(value)) throw new FormworkError("INVALID_RECORD", "记录必须是 object");
      const id = value.id === undefined ? randomUUID() : value.id;
      if (typeof id !== "string")
        throw new FormworkError("INVALID_RECORD", "记录 id 必须是 string");
      return serial(modelId, async () => {
        const file = path(modelId, id);
        if (await readStored(file)) throw new FormworkError("REVISION_CONFLICT", "记录 id 已存在");
        const record = await validate(modelId, value, id);
        await writeStored(file, record);
        return record;
      });
    },
    async update(modelId: string, id: string, value: unknown): Promise<RecordValue> {
      return serial(modelId, async () => {
        await read(modelId, id);
        if (!isObject(value) || value.id !== id)
          throw new FormworkError("INVALID_RECORD", "path/body id 必须一致");
        const record = await validate(modelId, value, id);
        await writeStored(path(modelId, id), record);
        return record;
      });
    },
    async remove(modelId: string, id: string) {
      return serial(modelId, async () => {
        await read(modelId, id);
        await rm(path(modelId, id));
        return { deleted: true };
      });
    },
    async query(modelId: string, input: unknown): Promise<RecordPage> {
      if (
        !isObject(input) ||
        !isObject(input.filters) ||
        !Number.isInteger(input.page) ||
        Number(input.page) < 1 ||
        !Number.isInteger(input.pageSize) ||
        Number(input.pageSize) < 1 ||
        Number(input.pageSize) > 100
      )
        throw new FormworkError(
          "INVALID_QUERY",
          "查询需要 filters、正整数 page 和 1–100 的 pageSize",
        );
      const query = input as RecordQuery;
      const model = (await models.read(modelId)).document;
      const scalar = (field: string) => {
        const raw = Object.hasOwn(model.data.properties, field)
          ? model.data.properties[field]
          : undefined;
        if (!raw) throw new FormworkError("UNKNOWN_FIELD", `未知查询字段 ${field}`);
        const schema = resolveSchema(raw, model.data);
        if (["object", "array"].includes(schemaType(schema)))
          throw new FormworkError("INVALID_QUERY", "查询与排序仅支持真实标量字段");
        return schema;
      };
      const filters = Object.entries(query.filters).map(([field, value]) => {
        const schema = scalar(field);
        const type = schemaType(schema);
        if (
          (value !== null && typeof value !== (type === "integer" ? "number" : type)) ||
          (value === null && !(type === "null" || ("type" in schema && Array.isArray(schema.type))))
        )
          throw new FormworkError("INVALID_QUERY", `筛选字段 ${field} 的值类型错误`);
        if ("enum" in schema && schema.enum && !schema.enum.includes(value as never))
          throw new FormworkError("INVALID_QUERY", `筛选值不在 ${field} enum 中`);
        return { field, value, contains: type === "string" && !("enum" in schema && schema.enum) };
      });
      if (query.sort) {
        if (
          !isObject(query.sort) ||
          typeof query.sort.field !== "string" ||
          !["asc", "desc"].includes(query.sort.direction)
        )
          throw new FormworkError("INVALID_QUERY", "排序需要 field 和 asc/desc");
        scalar(query.sort.field);
      }
      const dir = directory(modelId);
      await mkdir(dir, { recursive: true });
      const records: RecordValue[] = [];
      for (const file of (await readdir(dir)).filter((file) => file.endsWith(".json"))) {
        const bytes = await readStored(join(dir, file));
        if (!bytes) continue;
        const record = parseStored(bytes) as RecordValue;
        if (!isObject(record) || typeof record.id !== "string")
          throw new FormworkError("INVALID_DATA", "记录文件损坏");
        if (
          filters.every(({ field, value, contains }) =>
            contains
              ? typeof record[field] === "string" &&
                (record[field] as string).includes(value as string)
              : record[field] === value,
          )
        )
          records.push(record);
      }
      records.sort((a, b) => {
        if (query.sort) {
          const x = a[query.sort.field],
            y = b[query.sort.field];
          if (x === undefined && y !== undefined) return 1;
          if (y === undefined && x !== undefined) return -1;
          if (x !== y) {
            const delta =
              x === null
                ? -1
                : y === null
                  ? 1
                  : typeof x === "number" && typeof y === "number"
                    ? x - y
                    : typeof x === "boolean" && typeof y === "boolean"
                      ? Number(x) - Number(y)
                      : String(x).localeCompare(String(y));
            if (delta) return query.sort.direction === "asc" ? delta : -delta;
          }
        }
        return a.id.localeCompare(b.id);
      });
      return {
        list: records.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
        total: records.length,
      };
    },
  };
}
