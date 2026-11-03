import { FormworkError } from "formwork";
import {
  applyDefaults,
  checkAbort,
  cloneJson,
  pointerSegments,
  readPointer,
  resolveModel,
  queryClauseIssues,
  queryOperatorsForField,
  validateValue,
} from "formwork/model";
import type { EnumOption, ModelDocument, RecordValue, QueryClause } from "formwork/model";
import type { FormworkApis, ModelSnapshot, RecordCondition, RecordSnapshot } from "formwork/data";
import { cmsContract } from "../../../../../packages/domain-contracts";

function matches(record: RecordValue, { field, operator, operand }: QueryClause) {
  const value = readPointer(record, field);
  switch (operator) {
    case "eq":
      return value === operand;
    case "gt":
      return typeof value === "number" && value > Number(operand);
    case "gte":
      return typeof value === "number" && value >= Number(operand);
    case "lt":
      return typeof value === "number" && value < Number(operand);
    case "lte":
      return typeof value === "number" && value <= Number(operand);
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
}

/**
 * 为预览提供独立的内存 CRUD、查询和版本检查，不发起 HTTP 请求。
 * @param records 页面持有的缓存，Schema 改变后继续保留样例记录。
 */
export function createPreviewApi(
  document: ModelDocument,
  records = new Map<string, RecordSnapshot>(),
): FormworkApis {
  const model = resolveModel(document, cmsContract);
  const schemaRevision = crypto.randomUUID();
  const capabilities: ModelSnapshot["capabilities"] = {
    actions: { read: true, create: true, update: true, delete: true },
    fields: Object.fromEntries(
      model.fields.map((field) => [
        field.path,
        {
          read: true,
          create: !field.schema.readOnly,
          update: !field.schema.readOnly,
          filter: field.schema.query?.filter === false ? [] : queryOperatorsForField(field.schema),
          sort:
            !["object", "array"].includes(field.schema.type!) && field.schema.query?.sort !== false,
        },
      ]),
    ),
  };
  const assertModel = (id: string, signal?: AbortSignal) => {
    checkAbort(signal);
    if (id !== document.id)
      throw new FormworkError("PREVIEW_LOCAL_ONLY", "预览只提供当前模型的本地数据");
  };
  const snapshot = (record: RecordSnapshot) => structuredClone({ ...record, schemaRevision });
  const read = (id: string) => {
    const record = records.get(id);
    if (!record) throw new FormworkError("NOT_FOUND", "预览记录不存在");
    return snapshot(record);
  };
  const condition = (
    input: Pick<RecordCondition, "ifSchemaRevision"> & Partial<RecordCondition>,
    id?: string,
  ) => {
    if (input.ifSchemaRevision !== schemaRevision)
      throw new FormworkError("SCHEMA_CONFLICT", "预览模型已更新");
    if (id && read(id).revision !== input.ifRecordRevision)
      throw new FormworkError("RECORD_CONFLICT", "预览记录已更新");
  };
  const save = (id: string, data: RecordValue) => {
    const issues = [...validateValue(model.valueSchema, data), ...model.validateFormats(data)];
    if (issues.length) throw new FormworkError("INVALID_VALUE", "记录不满足字段契约", issues);
    const record = { id, data: cloneJson(data), revision: crypto.randomUUID(), schemaRevision };
    records.set(id, record);
    return snapshot(record);
  };
  return {
    models: {
      async get(input, context) {
        assertModel(input.modelId, context.signal);
        return { schema: structuredClone(document), schemaRevision, capabilities };
      },
    },
    records: {
      async get(input, context) {
        assertModel(input.modelId, context.signal);
        return read(input.recordId);
      },
      async create(input, context) {
        assertModel(input.modelId, context.signal);
        condition(input);
        const id = `preview-${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        return save(id, {
          ...(applyDefaults(model.valueSchema, input.data) as RecordValue),
          id,
          createdAt: now,
          updatedAt: now,
        });
      },
      async update(input, context) {
        assertModel(input.modelId, context.signal);
        condition(input, input.recordId);
        const current = read(input.recordId);
        const data = { ...current.data, ...cloneJson(input.changes.set ?? {}) };
        for (const pointer of input.changes.unset ?? []) {
          const parts = pointerSegments(pointer);
          if (parts.length !== 1 || model.field(pointer).schema.readOnly)
            throw new FormworkError("INVALID_PATCH", "unset 必须指向可写根字段");
          delete data[parts[0]!];
        }
        return save(current.id, {
          ...data,
          id: current.id,
          createdAt: current.data.createdAt!,
          updatedAt: new Date().toISOString(),
        });
      },
      async delete(input, context) {
        assertModel(input.modelId, context.signal);
        condition(input, input.recordId);
        records.delete(input.recordId);
        return { id: input.recordId, deleted: true };
      },
      async query({ modelId, query }, context) {
        assertModel(modelId, context.signal);
        const issues = query.clauses.flatMap((clause) =>
          queryClauseIssues(
            model.field(clause.field).schema,
            capabilities.fields[clause.field]?.filter ?? [],
            clause,
          ),
        );
        if (issues.length) throw new FormworkError("INVALID_QUERY", "查询条件无效", issues);
        const list = [...records.values()].filter((record) =>
          query.clauses.every((clause) => matches(record.data, clause)),
        );
        if (query.sort) {
          const { field, direction } = query.sort;
          list.sort((left, right) => {
            const a = readPointer(left.data, field);
            const b = readPointer(right.data, field);
            const order =
              typeof a === "number" && typeof b === "number"
                ? a - b
                : String(a ?? "").localeCompare(String(b ?? ""), "zh-CN", { numeric: true });
            return direction === "asc" ? order : -order;
          });
        }
        const offset = (query.page - 1) * query.pageSize;
        return {
          items: list.slice(offset, offset + query.pageSize).map(snapshot),
          total: list.length,
        };
      },
      async options(input, context) {
        assertModel(input.modelId, context.signal);
        const relation = model.fields.find(
          (field) => field.path === input.fieldId || field.schema.id === input.fieldId,
        )?.schema.relation;
        if (!relation) throw new FormworkError("INVALID_RELATION", "字段不是关系");
        if (relation.model !== document.id)
          throw new FormworkError("PREVIEW_LOCAL_ONLY", "跨模型关系请在已发布页面验证");
        const all: EnumOption[] = [...records.values()].flatMap(({ data }) => {
          const value = readPointer(data, relation.valueField ?? "/id");
          const label = readPointer(data, relation.labelField ?? "/name");
          return ["string", "number", "boolean"].includes(typeof value) && label !== undefined
            ? [{ value: value as string | number | boolean, label: String(label) }]
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
    },
  };
}
