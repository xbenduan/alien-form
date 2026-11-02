import { FormworkError } from "formwork";
import {
  applyDefaults,
  checkAbort,
  cloneJson,
  createFormworkApi,
  pointerSegments,
} from "formwork/model";
import type { FormworkApi, ModelDocument, RecordValue } from "formwork/model";
import { capabilities } from "virtual:formwork/capabilities";

/**
 * 从空列表提供前端 CRUD，所有记录操作只读写预览内存。
 * @param records 由预览页面持有的缓存，重建 Schema 对应的 API 时继续使用同一份记录。
 */
export function createPreviewApi(
  document: ModelDocument,
  records = new Map<string, RecordValue>(),
): FormworkApi {
  const assertModel = (id: string, signal?: AbortSignal) => {
    checkAbort(signal);
    if (id !== document.id)
      throw new FormworkError("INVALID_MODEL", "预览仅提供当前模型的本地数据。");
  };
  const read = (id: string): RecordValue => {
    const value = records.get(id);
    if (!value) throw new FormworkError("NOT_FOUND", "预览记录不存在。");
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
    async capabilities(id, target, options) {
      assertModel(id, options?.signal);
      return capabilities(
        options?.domain === undefined ? document : { ...document, domain: options.domain },
        typeof target === "string" ? { router: target } : target,
      );
    },
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
            query.parentId !== undefined &&
            document.tree &&
            record[pointerSegments(document.tree.parentField)[0]!] !== query.parentId
          )
            return false;
          if (
            query.keyword &&
            !JSON.stringify(record).toLocaleLowerCase().includes(query.keyword.toLocaleLowerCase())
          )
            return false;
          return Object.entries(query.filters).every(([field, value]) =>
            typeof value === "string"
              ? String(record[field] ?? "")
                  .toLocaleLowerCase()
                  .includes(value.toLocaleLowerCase())
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
      async subtree(id, input, options) {
        assertModel(id, options?.signal);
        if (!document.tree || pointerSegments(document.tree.parentField)[0] !== input.parentField)
          throw new FormworkError("INVALID_MODEL", "预览树字段与模型不一致");
        const rows = [...records.values()];
        if (!input.parentValue) return cloneJson(rows);
        const selected = new Set([input.parentValue]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const row of rows)
            if (
              !selected.has(row.id as string) &&
              selected.has(String(row[input.parentField] ?? ""))
            ) {
              selected.add(row.id as string);
              changed = true;
            }
        }
        return cloneJson(
          rows.filter((row) => row.id !== input.parentValue && selected.has(row.id as string)),
        );
      },
      async read(id, recordId, options) {
        assertModel(id, options?.signal);
        return read(recordId);
      },
      async create(id, value, options) {
        assertModel(id, options?.signal);
        const recordId = `preview-${crypto.randomUUID()}`;
        records.set(recordId, {
          ...(applyDefaults(document.data, value) as RecordValue),
          id: recordId,
        });
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
