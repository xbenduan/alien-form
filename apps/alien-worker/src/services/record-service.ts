import type {
  ModelRecord,
  AlienSchema,
  ListRequest,
  OptionsRequest,
  SubtreeRequest,
} from "@alien-form/protocol";
import { AppError, badRequest, conflict, forbidden, notFound } from "../errors.ts";
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
import type { AuthorizationService, AccessProfile } from "./authorization-service.ts";

export type ListInput = ListRequest;
export type OptionsInput = OptionsRequest;
export type SubtreeInput = SubtreeRequest;

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function assertFieldValue(field: AlienSchema["fields"][number], value: unknown): void {
  if (isEmpty(value)) {
    if (field.required === true) throw new AppError(`${field.key} 必填`, 400);
    return;
  }
  const type = field.type;
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

function normalizeRecord(schema: AlienSchema, values: Record<string, unknown>): ModelRecord {
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
    if (value === undefined && field.storage?.default !== undefined) {
      value = field.storage.default;
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
    private readonly authorization: AuthorizationService,
  ) {}

  private async requireModel(model: string): Promise<AlienSchema> {
    const schema = await this.models.get(model);
    if (!schema) throw notFound(`未知模型：${model}`);
    return schema;
  }

  private selfRelation(schema: AlienSchema): AlienSchema["fields"][number] {
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
    const source = await this.requireModel(input.model);
    const profile = await this.authorization.profile(authId);
    const scope = this.authorization.assertCan(profile, source, "read");
    const schema = this.authorization.projectSchema(profile, source);
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
      ownerId: scope === "own" ? authId : undefined,
    });
    const expanded = await this.refs.expand(schema, result.list);
    return {
      ...result,
      list: expanded.map((record) => this.visibleRecord(profile, schema, record)),
    };
  }

  async options(input: OptionsInput, actorId: string): Promise<OptionResult> {
    const source = await this.requireModel(input.model);
    const profile = await this.authorization.profile(actorId);
    const scope = this.authorization.assertCan(profile, source, "read");
    const schema = this.authorization.projectSchema(profile, source);
    const available = new Set(schema.fields.map((field) => field.key));
    if (
      !available.has(input.valueKey ?? "id") ||
      !available.has(input.labelKey ?? input.valueKey ?? "id")
    ) {
      throw forbidden("无权读取关联选项字段");
    }
    return this.records.options(schema, {
      valueKey: input.valueKey ?? "id",
      labelKey: input.labelKey ?? input.valueKey ?? "id",
      keyword: input.keyword,
      selectedValues: input.selectedValues,
      limit: input.limit,
      ownerId: scope === "own" ? actorId : undefined,
    });
  }

  async subtree(input: SubtreeInput, actorId: string): Promise<{ list: ModelRecord[] }> {
    const source = await this.requireModel(input.model);
    const profile = await this.authorization.profile(actorId);
    const scope = this.authorization.assertCan(profile, source, "read");
    const schema = this.authorization.projectSchema(profile, source);
    const list = await this.records.subtree(schema, {
      idField: input.idField ?? "id",
      parentField: input.parentField ?? "id",
      parentValue: input.parentValue,
      ownerId: scope === "own" ? actorId : undefined,
    });
    const expanded = await this.refs.expand(schema, list);
    return { list: expanded.map((record) => this.visibleRecord(profile, schema, record)) };
  }

  async get(model: string, id: string, actorId: string): Promise<ModelRecord> {
    const source = await this.requireModel(model);
    const profile = await this.authorization.profile(actorId);
    const scope = this.authorization.assertCan(profile, source, "read");
    const schema = this.authorization.projectSchema(profile, source);
    const record = await this.records.get(schema, id);
    if (!record) throw notFound(`记录不存在：${id}`);
    await this.assertOwnership(scope, source, id, actorId);
    return this.visibleRecord(profile, schema, await this.refs.expandOne(schema, record));
  }

  async create(
    model: string,
    values: Record<string, unknown>,
    actorId: string,
  ): Promise<ModelRecord> {
    const schema = await this.requireModel(model);
    const profile = await this.authorization.profile(actorId);
    this.authorization.assertCan(profile, schema, "create");
    this.authorization.assertFields(profile, schema, "create", Object.keys(values));
    const clean = await this.transform(model, unwrapRefs(values) ?? {}, actorId, "create");
    const id =
      typeof clean.id === "string" && clean.id ? clean.id : await this.records.allocateId();
    const candidate = normalizeRecord(schema, { ...clean, id });
    await this.validate(schema, candidate, actorId, "create");
    await this.runBefore(model, "beforeCreate", {
      model: schema,
      models: this.models,
      records: this.records,
      actorId,
      operation: "create",
      record: immutable(candidate),
    });
    try {
      const record = await this.records.create(schema, candidate, actorId);
      await this.runAfter(model, "afterCreate", schema, actorId, record);
      return this.visibleRecord(profile, schema, await this.refs.expandOne(schema, record));
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
    const profile = await this.authorization.profile(actorId);
    const scope = this.authorization.assertCan(profile, schema, "update");
    this.authorization.assertFields(profile, schema, "update", Object.keys(values));
    const previous = await this.records.get(schema, id);
    if (!previous) throw notFound(`记录不存在：${id}`);
    const ownerId = await this.assertOwnership(scope, schema, id, actorId);
    const clean = await this.transform(
      model,
      unwrapRefs(values) ?? {},
      actorId,
      "update",
      previous,
    );
    const candidate = normalizeRecord(schema, { ...previous, ...clean, id });
    await this.validate(schema, candidate, actorId, "update", previous);
    await this.runBefore(model, "beforeUpdate", {
      model: schema,
      models: this.models,
      records: this.records,
      actorId,
      operation: "update",
      previous: immutable(previous),
      record: immutable(candidate),
    });
    try {
      const record = await this.records.update(schema, id, candidate, ownerId);
      if (!record) throw notFound(`记录不存在：${id}`);
      await this.runAfter(model, "afterUpdate", schema, actorId, record, previous);
      return this.visibleRecord(profile, schema, await this.refs.expandOne(schema, record));
    } catch (reason) {
      if (isUniqueViolation(reason)) throw conflict("唯一字段值已存在");
      throw reason;
    }
  }

  async remove(model: string, id: string, actorId: string): Promise<void> {
    const schema = await this.requireModel(model);
    const scope = this.authorization.assertCan(
      await this.authorization.profile(actorId),
      schema,
      "delete",
    );
    const record = await this.records.get(schema, id);
    if (!record) return;
    await this.assertOwnership(scope, schema, id, actorId);
    await this.runBefore(model, "beforeDelete", {
      model: schema,
      models: this.models,
      records: this.records,
      actorId,
      operation: "delete",
      record: immutable(record),
    });
    await this.records.delete(schema, id);
    await this.runAfter(model, "afterDelete", schema, actorId, record);
  }

  async removeMany(model: string, ids: string[], actorId: string): Promise<void> {
    const schema = await this.requireModel(model);
    const scope = this.authorization.assertCan(
      await this.authorization.profile(actorId),
      schema,
      "delete",
    );
    const records = (await Promise.all(ids.map((id) => this.records.get(schema, id)))).filter(
      (record): record is ModelRecord => record !== undefined,
    );
    await Promise.all(
      records.map((record) => this.assertOwnership(scope, schema, record.id, actorId)),
    );
    for (const record of records) {
      await this.runBefore(model, "beforeDelete", {
        model: schema,
        models: this.models,
        records: this.records,
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
    schema: AlienSchema,
    record: ModelRecord,
    actorId: string,
    operation: "create" | "update",
    previous?: ModelRecord,
  ): Promise<void> {
    const registration = this.registry.get(schema.name);
    if (!registration) return;
    const context: ModelValidationContext = {
      model: schema,
      models: this.models,
      records: this.records,
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

  private async transform(
    model: string,
    values: Record<string, unknown>,
    actorId: string,
    operation: "create" | "update",
    previous?: ModelRecord,
  ): Promise<Record<string, unknown>> {
    try {
      return (
        (await this.registry.get(model)?.transform?.(values, {
          actorId,
          operation,
          previous: previous ? immutable(previous) : undefined,
        })) ?? values
      );
    } catch (reason) {
      if (reason instanceof AppError) throw reason;
      throw badRequest(reason instanceof Error ? reason.message : String(reason));
    }
  }

  private visibleRecord(
    profile: AccessProfile,
    schema: AlienSchema,
    record: ModelRecord,
  ): ModelRecord {
    return this.authorization.project(profile, schema, publicRecord(schema.name, record));
  }

  /** Enforces `scope: own` and returns the persisted owner for updates. */
  private async assertOwnership(
    scope: "all" | "own",
    schema: AlienSchema,
    id: string,
    actorId: string,
  ): Promise<string | undefined> {
    const ownerId = await this.records.owner(schema, id);
    if (scope === "own" && ownerId !== actorId) throw forbidden("无权访问其他用户创建的数据");
    return ownerId;
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
    schema: AlienSchema,
    actorId: string,
    record: ModelRecord,
    previous?: ModelRecord,
  ): Promise<void> {
    try {
      await this.registry.get(model)?.hooks?.[hook]?.({
        model: schema,
        models: this.models,
        records: this.records,
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
