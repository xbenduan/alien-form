import type {
  ModelFieldSchema,
  ModelRecord,
  ModelSchema,
  ListRequest,
  OptionsRequest,
  SubtreeRequest,
} from "@alien-form/protocol";
import { AppError, badRequest, conflict, notFound } from "../errors.ts";
import { publicRecord } from "../domain/visibility.ts";
import type {
  ModelLifecycleContext,
  ModelRegistry,
  ModelValidationContext,
} from "../register/index.ts";
import type { ModelStore } from "../store/model-store.ts";
import type { ListResult, OptionResult, RecordStore } from "../store/record-store.ts";
import type { RefExpander } from "../store/ref-expander.ts";
import { unwrapRefs } from "../store/ref-expander.ts";

export type ListInput = ListRequest;
export type OptionsInput = OptionsRequest;
export type SubtreeInput = SubtreeRequest;

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function assertFieldValue(field: ModelFieldSchema, value: unknown): void {
  if (isEmpty(value)) {
    if (field.form.required === true) throw new AppError(`${field.key} 必填`, 400);
    return;
  }
  const type = field.form.type;
  if (type === "string" && typeof value !== "string") {
    throw new AppError(`${field.key} 必须为字符串`, 400);
  }
  if (type === "number" && typeof value !== "number") {
    throw new AppError(`${field.key} 必须为数字`, 400);
  }
  if (type === "boolean" && typeof value !== "boolean") {
    throw new AppError(`${field.key} 必须为布尔值`, 400);
  }
  if (type === "object" && (typeof value !== "object" || Array.isArray(value))) {
    throw new AppError(`${field.key} 必须为对象`, 400);
  }
  if (type === "array" && !Array.isArray(value)) {
    throw new AppError(`${field.key} 必须为数组`, 400);
  }
}

function normalizeRecord(schema: ModelSchema, values: Record<string, unknown>): ModelRecord {
  const fields = new Map(schema.fields.map((field) => [field.key, field]));
  for (const key of Object.keys(values)) {
    if (!fields.has(key)) throw new AppError(`未知字段：${key}`, 400);
  }
  const record: ModelRecord = { id: String(values.id ?? "") };
  for (const field of schema.fields) {
    if (field.key === "id" || field.key === "createdAt" || field.key === "updatedAt") {
      continue;
    }
    let value = values[field.key];
    if (value === undefined && field.database?.default !== undefined) {
      value = field.database.default;
    }
    if (value === undefined && field.form.default !== undefined) value = field.form.default;
    assertFieldValue(field, value);
    if (value !== undefined) record[field.key] = value;
  }
  return record;
}

function immutable(record: ModelRecord): Readonly<ModelRecord> {
  return Object.freeze({ ...record });
}

function isUniqueViolation(reason: unknown): boolean {
  return reason instanceof Error && reason.message.includes("UNIQUE constraint failed");
}

export class RecordService {
  constructor(
    private readonly models: ModelStore,
    private readonly records: RecordStore,
    private readonly refs: RefExpander,
    private readonly registry: ModelRegistry,
  ) {}

  private async requireModel(model: string): Promise<ModelSchema> {
    const schema = await this.models.get(model);
    if (!schema) throw notFound(`未知模型：${model}`);
    return schema;
  }

  private selfRelation(schema: ModelSchema): ModelFieldSchema {
    const relations = schema.fields.filter(
      (field) => field.relation?.kind === "many-to-one" && field.relation.target === schema.name,
    );
    if (relations.length !== 1) {
      throw new AppError(
        `模型 ${schema.name} 必须且只能定义一个 many-to-one 自关联字段才能使用 parentId 查询`,
        400,
      );
    }
    return relations[0];
  }

  async list(input: ListInput, authId: string): Promise<ListResult> {
    const schema = await this.requireModel(input.model);
    const relation =
      input.parentId === undefined || input.parentId === null || input.parentId === ""
        ? undefined
        : this.selfRelation(schema);
    const result = await this.records.list(schema, {
      filter: input.filter,
      authId,
      pagination: input.pagination,
      sorter: input.sorter,
      keyword: input.keyword,
      searchFields: input.searchFields,
      parentId: input.parentId,
      idField: relation?.relation?.valueField ?? "id",
      parentField: relation?.key,
    });
    const expanded = await this.refs.expand(schema, result.list);
    return { ...result, list: expanded.map((record) => publicRecord(input.model, record)) };
  }

  async options(input: OptionsInput): Promise<OptionResult> {
    const schema = await this.requireModel(input.model);
    return this.records.options(schema, {
      valueKey: input.valueKey ?? "id",
      labelKey: input.labelKey ?? input.valueKey ?? "id",
      keyword: input.keyword,
      selectedValues: input.selectedValues,
      limit: input.limit,
    });
  }

  async subtree(input: SubtreeInput): Promise<{ list: ModelRecord[] }> {
    const schema = await this.requireModel(input.model);
    const list = await this.records.subtree(schema, {
      idField: input.idField ?? "id",
      parentField: input.parentField ?? "id",
      parentValue: input.parentValue,
    });
    const expanded = await this.refs.expand(schema, list);
    return { list: expanded.map((record) => publicRecord(input.model, record)) };
  }

  async get(model: string, id: string): Promise<ModelRecord> {
    const schema = await this.requireModel(model);
    const record = await this.records.get(schema, id);
    if (!record) throw notFound(`记录不存在：${id}`);
    return publicRecord(model, await this.refs.expandOne(schema, record));
  }

  async create(
    model: string,
    values: Record<string, unknown>,
    actorId: string,
  ): Promise<ModelRecord> {
    const schema = await this.requireModel(model);
    const clean = unwrapRefs(values) ?? {};
    const id =
      typeof clean.id === "string" && clean.id ? clean.id : await this.records.allocateId();
    const candidate = normalizeRecord(schema, { ...clean, id });
    await this.validate(schema, candidate, actorId, "create");
    await this.runBefore(model, "beforeCreate", {
      model: schema,
      actorId,
      operation: "create",
      record: immutable(candidate),
    });
    try {
      const record = await this.records.create(schema, candidate);
      await this.runAfter(model, "afterCreate", schema, actorId, record);
      return publicRecord(model, await this.refs.expandOne(schema, record));
    } catch (reason) {
      if (isUniqueViolation(reason)) throw conflict("唯一字段值已存在");
      throw reason;
    }
  }

  async update(
    model: string,
    id: string,
    values: Record<string, unknown>,
    actorId: string,
  ): Promise<ModelRecord> {
    const schema = await this.requireModel(model);
    const previous = await this.records.get(schema, id);
    if (!previous) throw notFound(`记录不存在：${id}`);
    const clean = unwrapRefs(values) ?? {};
    const candidate = normalizeRecord(schema, { ...previous, ...clean, id });
    await this.validate(schema, candidate, actorId, "update", previous);
    await this.runBefore(model, "beforeUpdate", {
      model: schema,
      actorId,
      operation: "update",
      previous: immutable(previous),
      record: immutable(candidate),
    });
    try {
      const record = await this.records.update(schema, id, candidate);
      if (!record) throw notFound(`记录不存在：${id}`);
      await this.runAfter(model, "afterUpdate", schema, actorId, record, previous);
      return publicRecord(model, await this.refs.expandOne(schema, record));
    } catch (reason) {
      if (isUniqueViolation(reason)) throw conflict("唯一字段值已存在");
      throw reason;
    }
  }

  async remove(model: string, id: string, actorId: string): Promise<void> {
    const schema = await this.requireModel(model);
    const record = await this.records.get(schema, id);
    if (!record) return;
    await this.runBefore(model, "beforeDelete", {
      model: schema,
      actorId,
      operation: "delete",
      record: immutable(record),
    });
    await this.records.delete(schema, id);
    await this.runAfter(model, "afterDelete", schema, actorId, record);
  }

  async removeMany(model: string, ids: string[], actorId: string): Promise<void> {
    const schema = await this.requireModel(model);
    const records = (await Promise.all(ids.map((id) => this.records.get(schema, id)))).filter(
      (record): record is ModelRecord => record !== undefined,
    );
    for (const record of records) {
      await this.runBefore(model, "beforeDelete", {
        model: schema,
        actorId,
        operation: "delete",
        record: immutable(record),
      });
    }
    await this.records.deleteMany(
      schema,
      records.map((record) => record.id),
    );
    for (const record of records) {
      await this.runAfter(model, "afterDelete", schema, actorId, record);
    }
  }

  private async validate(
    schema: ModelSchema,
    record: ModelRecord,
    actorId: string,
    operation: "create" | "update",
    previous?: ModelRecord,
  ): Promise<void> {
    const registration = this.registry.get(schema.name);
    if (!registration) return;
    const context: ModelValidationContext = {
      model: schema,
      actorId,
      operation,
      record: immutable(record),
      previous: previous ? immutable(previous) : undefined,
    };
    try {
      for (const [field, validator] of Object.entries(registration.validators ?? {})) {
        await validator(record[field], context);
      }
      await registration.validate?.(context);
    } catch (reason) {
      if (reason instanceof AppError) throw reason;
      throw badRequest(reason instanceof Error ? reason.message : String(reason));
    }
  }

  private async runBefore(
    model: string,
    hook: "beforeCreate" | "beforeUpdate" | "beforeDelete",
    context: ModelLifecycleContext,
  ): Promise<void> {
    try {
      await this.registry.get(model)?.hooks?.[hook]?.(context);
    } catch (reason) {
      if (reason instanceof AppError) throw reason;
      throw badRequest(reason instanceof Error ? reason.message : String(reason));
    }
  }

  private async runAfter(
    model: string,
    hook: "afterCreate" | "afterUpdate" | "afterDelete",
    schema: ModelSchema,
    actorId: string,
    record: ModelRecord,
    previous?: ModelRecord,
  ): Promise<void> {
    try {
      await this.registry.get(model)?.hooks?.[hook]?.({
        model: schema,
        actorId,
        operation: hook === "afterCreate" ? "create" : hook === "afterUpdate" ? "update" : "delete",
        record: immutable(record),
        previous: previous ? immutable(previous) : undefined,
      });
    } catch (reason) {
      console.error(
        JSON.stringify({
          message: "model lifecycle after hook failed",
          model,
          hook,
          error: reason instanceof Error ? reason.message : String(reason),
        }),
      );
    }
  }
}
