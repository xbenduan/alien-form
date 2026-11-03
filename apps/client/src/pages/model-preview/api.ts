import { FormworkError } from "formwork";
import {
  applyDefaults,
  checkAbort,
  cloneJson,
  createFormworkApi,
  pointerSegments,
  readPointer,
  resolveModel,
  queryClauseIssues,
  validateValue,
} from "formwork/model";
import type {
  EnumOption,
  FormworkApi,
  ModelDocument,
  RecordCapabilities,
  RecordValue,
  QueryOperator,
} from "formwork/model";
import { capabilities } from "virtual:formwork/capabilities";
import { modelContract } from "../../../../../packages/domain-contracts";

/**
 * 从空列表提供前端 CRUD，所有记录操作只读写预览内存。
 * @param records 由预览页面持有的缓存，重建 Schema 对应的 API 时继续使用同一份记录。
 */
export function createPreviewApi(
  document: ModelDocument,
  records = new Map<string, RecordValue>(),
): FormworkApi {
  const model = resolveModel(document, modelContract(document));
  const recordCapabilities: RecordCapabilities = {
    fields: Object.fromEntries(
      model.fields.map((field) => {
        const scalar = !["object", "array"].includes(field.schema.type!);
        const filter: QueryOperator[] = scalar
          ? ["eq", "in"]
          : field.schema.type === "array" &&
              ["string", "number", "integer", "boolean"].includes(field.schema.items?.type ?? "")
            ? ["in"]
            : [];
        if (field.schema.type === "string" && !field.schema.enum && !field.schema.relation)
          filter.push("contains");
        if (field.schema.type === "number" || field.schema.type === "integer")
          filter.push("between");
        if (
          field.schema.nullable ||
          field.schema.type === "null" ||
          field.options.some((option) => option.value === null)
        )
          filter.push("isNull", "isNotNull");
        return [
          field.path,
          {
            read: true,
            create: !field.schema.readOnly,
            update: !field.schema.readOnly,
            filter: field.schema.query?.filter === false ? [] : filter,
            sort: scalar && field.schema.query?.sort !== false,
          },
        ];
      }),
    ),
  };
  const save = (id: string, record: RecordValue) => {
    const issues = [...validateValue(model.valueSchema, record), ...model.validateFormats(record)];
    if (issues.length) throw new FormworkError("INVALID_VALUE", "记录不满足字段契约", issues);
    records.set(id, record);
    return cloneJson(record);
  };
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
        return {
          schema: structuredClone(document),
          version: 1,
          revision: "preview",
          capabilities: recordCapabilities,
        };
      },
    },
    records: {
      async options(id, input, options) {
        assertModel(id, options?.signal);
        const field = model.fields.find(
          (field) => field.path === input.fieldId || field.schema.id === input.fieldId,
        );
        const relation = field?.schema.relation;
        if (!relation) throw new FormworkError("INVALID_RELATION", "字段不是关系");
        if (relation.model !== document.id)
          throw new FormworkError(
            "PREVIEW_LOCAL_ONLY",
            "跨模型关系需在已发布页面验证，本地预览不读取线上记录。",
          );
        const all: EnumOption[] = [...records.values()].flatMap((record) => {
          const value = readPointer(record, relation.valueField ?? "/id");
          const label = readPointer(record, relation.labelField ?? "/name");
          return (typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean") &&
            label !== undefined
            ? [{ value, label: String(label) }]
            : [];
        });
        const filtered = all.filter((option) =>
          input.selectedValues
            ? option.value !== null && input.selectedValues.includes(option.value)
            : !input.keyword ||
              option.label.toLocaleLowerCase().includes(input.keyword.toLocaleLowerCase()),
        );
        return {
          options: filtered.slice(0, input.selectedValues ? 200 : (input.limit ?? 100)),
          total: filtered.length,
        };
      },
      async patch(id, recordId, patch, options) {
        assertModel(id, options?.signal);
        const record = { ...read(recordId), ...cloneJson(patch.set ?? {}), id: recordId };
        for (const pointer of patch.unset ?? []) {
          const parts = pointerSegments(pointer);
          if (parts.length !== 1 || parts[0] === "id")
            throw new FormworkError("INVALID_PATCH", "unset 必须指向可写根字段");
          delete (record as RecordValue)[parts[0]!];
        }
        return save(recordId, record);
      },
      async query(id, query, options) {
        assertModel(id, options?.signal);
        const issues = query.clauses.flatMap((clause) =>
          queryClauseIssues(
            model.field(clause.field).schema,
            recordCapabilities.fields[clause.field]?.filter ?? [],
            clause,
          ),
        );
        if (issues.length) throw new FormworkError("INVALID_QUERY", "查询条件无效", issues);
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
          return query.clauses.every(({ field, operator, operand }) => {
            const value = readPointer(record, field);
            switch (operator) {
              case "eq":
                return value === operand;
              case "contains":
                return (
                  typeof value === "string" &&
                  value.toLocaleLowerCase().includes(String(operand).toLocaleLowerCase())
                );
              case "in":
                return (
                  Array.isArray(operand) &&
                  (Array.isArray(value)
                    ? value.some((item) => operand.includes(item))
                    : operand.includes(value as never))
                );
              case "between":
                return (
                  typeof value === "number" &&
                  Array.isArray(operand) &&
                  value >= Number(operand[0]) &&
                  value <= Number(operand[1])
                );
              case "isNull":
                return value === null;
              case "isNotNull":
                return value !== undefined && value !== null;
            }
          });
        });
        if (query.sort) {
          const { field, direction } = query.sort;
          list.sort((left, right) => {
            const a = readPointer(left, field);
            const b = readPointer(right, field);
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
        return save(recordId, {
          ...(applyDefaults(model.valueSchema, value) as RecordValue),
          id: recordId,
        });
      },
      async update(id, recordId, value, options) {
        assertModel(id, options?.signal);
        return save(recordId, { ...read(recordId), ...cloneJson(value), id: recordId });
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
