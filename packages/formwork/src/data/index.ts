import { z } from "zod";
import { checkAbort, FormworkError } from "../model/errors";
import { modelDocumentSchema } from "../model/schema";
import type {
  ModelNavigationEntry,
  ReadOptions,
  RuntimeSnapshot,
  RecordPatch,
  RecordQuery,
  RecordValue,
  RelationOptionsInput,
  RelationOptionsResult,
} from "../model/types";

/** 将数据身份和并发版本放在可编辑字段之外。 */
export type RecordSnapshot = {
  id: string;
  data: RecordValue;
  revision: string;
  schemaRevision: string;
};
/** 为运行时提供授权后的模型及其不可变版本。 */
export type ModelSnapshot = RuntimeSnapshot;
/** 返回当前查询页；total 必须来自同一筛选条件。 */
export type QueryResult = { items: RecordSnapshot[]; total: number };
/** 将取消信号及请求标识传给使用者的适配器。 */
export type ApiContext = { signal?: AbortSignal; requestId: string };
type ModelInput = { modelId: string };
type RecordInput = ModelInput & { recordId: string };
/** 固定编辑开始时的模型版本和记录版本，不用保存前的重新读取替代。 */
export type RecordCondition = { ifSchemaRevision: string; ifRecordRevision: string };
/** 注入模型和记录的逻辑操作；缺少写方法表示不提供该动作。 */
export type FormworkApis = {
  models: {
    get: (input: ModelInput, context: ApiContext) => Promise<ModelSnapshot>;
    list?: (input: Record<string, never>, context: ApiContext) => Promise<ModelNavigationEntry[]>;
  };
  records: {
    get: (input: RecordInput, context: ApiContext) => Promise<RecordSnapshot>;
    query?: (
      input: ModelInput & { query: RecordQuery },
      context: ApiContext,
    ) => Promise<QueryResult>;
    create?: (
      input: ModelInput & { data: RecordValue; ifSchemaRevision: string },
      context: ApiContext,
    ) => Promise<RecordSnapshot>;
    update?: (
      input: RecordInput & RecordCondition & { changes: RecordPatch },
      context: ApiContext,
    ) => Promise<RecordSnapshot>;
    delete?: (
      input: RecordInput & RecordCondition,
      context: ApiContext,
    ) => Promise<{ id: string; deleted: true }>;
    options?: (
      input: ModelInput & RelationOptionsInput,
      context: ApiContext,
    ) => Promise<RelationOptionsResult>;
  };
};
/** 通知同一数据客户端中的查询失效，不在不同 app 或预览环境间共享状态。 */
export type DataChange = {
  modelId: string;
  recordId: string;
  action: "create" | "update" | "delete";
};

const nonempty = z.string().min(1);
const snapshotSchema = z.object({
  id: nonempty,
  data: z.record(z.string(), z.json()),
  revision: nonempty,
  schemaRevision: nonempty,
});
const modelSnapshotSchema = z.object({
  schema: modelDocumentSchema,
  schemaRevision: nonempty,
  capabilities: z.object({
    actions: z.object({
      read: z.boolean(),
      create: z.boolean(),
      update: z.boolean(),
      delete: z.boolean(),
    }),
    fields: z.record(
      z.string(),
      z.object({
        read: z.boolean(),
        create: z.boolean().optional(),
        update: z.boolean().optional(),
        filter: z.array(
          z.enum([
            "eq",
            "gt",
            "gte",
            "lt",
            "lte",
            "in",
            "contains",
            "between",
            "isNull",
            "isNotNull",
          ]),
        ),
        sort: z.boolean(),
      }),
    ),
  }),
});
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value, { jitless: true });
  if (!result.success)
    throw new FormworkError(
      "INVALID_RESPONSE",
      "API 返回值不符合 Formwork 数据协议",
      result.error.issues.map((issue) => ({
        path: `/${issue.path.join("/")}`,
        code: "INVALID_RESPONSE",
        message: issue.message,
      })),
    );
  return result.data;
}
function identity(value: string): void {
  if (!value || value === "." || value === "..")
    throw new FormworkError("INVALID_INPUT", "模型和记录 id 必须是非空的安全路径段");
}
function condition(input: RecordCondition): void {
  if (!input.ifRecordRevision || !input.ifSchemaRevision)
    throw new FormworkError("PRECONDITION_REQUIRED", "写入需要编辑开始时的模型和记录版本");
}

/** 创建不依赖 Solid 或 DOM 的数据客户端，校验响应并广播已提交的变更。 */
export function createDataClient({ apis }: { apis: FormworkApis }) {
  const listeners = new Set<(change: DataChange) => void>();
  const call = async <I, O>(
    api: ((input: I, context: ApiContext) => Promise<O>) | undefined,
    input: I,
    options?: ReadOptions,
  ): Promise<O> => {
    if (!api) throw new FormworkError("OPERATION_UNAVAILABLE", "未接入此数据操作");
    checkAbort(options?.signal);
    const output = await api(structuredClone(input), {
      signal: options?.signal,
      requestId: crypto.randomUUID(),
    });
    checkAbort(options?.signal);
    return output;
  };
  const notify = (change: DataChange) => {
    for (const listener of listeners) {
      try {
        listener(change);
      } catch (error) {
        console.error("Formwork data listener:", error);
      }
    }
  };
  const record = (value: unknown, recordId?: string) => {
    const result = parse(snapshotSchema, value);
    if (recordId !== undefined && result.id !== recordId)
      throw new FormworkError("INVALID_RESPONSE", "API 返回了其他记录");
    return result;
  };
  return {
    apis,
    subscribe(listener: (change: DataChange) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async getModel(input: ModelInput, options?: ReadOptions): Promise<ModelSnapshot> {
      identity(input.modelId);
      const result = parse(modelSnapshotSchema, await call(apis.models.get, input, options));
      if (result.schema.id !== input.modelId)
        throw new FormworkError("INVALID_RESPONSE", "API 返回了其他模型");
      return result;
    },
    async query(
      input: ModelInput & { query: RecordQuery },
      options?: ReadOptions,
    ): Promise<QueryResult> {
      identity(input.modelId);
      if (
        !Number.isSafeInteger(input.query.page) ||
        input.query.page < 1 ||
        !Number.isSafeInteger(input.query.pageSize) ||
        input.query.pageSize < 1
      )
        throw new FormworkError("INVALID_QUERY", "page 和 pageSize 必须是正整数");
      return parse(
        z.object({ items: z.array(snapshotSchema), total: z.number().int().nonnegative() }),
        await call(apis.records.query, input, options),
      );
    },
    async getRecord(input: RecordInput, options?: ReadOptions): Promise<RecordSnapshot> {
      identity(input.modelId);
      identity(input.recordId);
      return record(await call(apis.records.get, input, options), input.recordId);
    },
    async create(
      input: ModelInput & { data: RecordValue; ifSchemaRevision: string },
      options?: ReadOptions,
    ) {
      identity(input.modelId);
      if (!input.ifSchemaRevision)
        throw new FormworkError("PRECONDITION_REQUIRED", "新建记录需要模型版本");
      const result = record(await call(apis.records.create, input, options));
      notify({ modelId: input.modelId, recordId: result.id, action: "create" });
      return result;
    },
    async update(
      input: RecordInput & RecordCondition & { changes: RecordPatch },
      options?: ReadOptions,
    ) {
      identity(input.modelId);
      identity(input.recordId);
      condition(input);
      const result = record(await call(apis.records.update, input, options), input.recordId);
      notify({ modelId: input.modelId, recordId: result.id, action: "update" });
      return result;
    },
    async delete(input: RecordInput & RecordCondition, options?: ReadOptions) {
      identity(input.modelId);
      identity(input.recordId);
      condition(input);
      const result = parse(
        z.object({ id: nonempty, deleted: z.literal(true) }),
        await call(apis.records.delete, input, options),
      );
      if (result.id !== input.recordId)
        throw new FormworkError("INVALID_RESPONSE", "API 删除响应的记录 id 不匹配");
      notify({ modelId: input.modelId, recordId: result.id, action: "delete" });
      return result;
    },
    options(input: ModelInput & RelationOptionsInput, options?: ReadOptions) {
      identity(input.modelId);
      return call(apis.records.options, input, options);
    },
  };
}
/** 共享一个适配器实例的记录操作和变更订阅。 */
export type DataClient = ReturnType<typeof createDataClient>;
