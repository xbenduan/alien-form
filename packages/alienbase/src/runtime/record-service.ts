import type {
  AlienSchema,
  AlienValue,
  ListRequest,
  ModelRecord,
  OptionsRequest,
  PermissionAction,
  SubtreeRequest,
} from "@alien-form/protocol";
import { isPluginMarker } from "@alien-form/protocol";
import { AppError, conflict, forbidden, notFound } from "../errors.ts";
import type { AccessControl, AccessProfile, PermissionScope } from "./access-control.ts";
import type {
  CompiledModel,
  CompiledModelProvider,
  DomainEvent,
  EventCollector,
  ModelCommandMutation,
  ModelWriteOperation,
  RecordExpander,
  RecordListResult,
  RecordMutation,
  RecordOptionResult,
  RecordReader,
  TransactionPlan,
  UnitOfWork,
} from "./contracts.ts";
import {
  prepareModelInput,
  presentModelRecord,
  runBeforePersist,
  validateModelRecord,
} from "./model-middleware.ts";
import { normalizeRecord } from "./record-validation.ts";

export type ListInput = ListRequest;
export type OptionsInput = OptionsRequest;
export type SubtreeInput = SubtreeRequest;

export interface CommandExecutionResult {
  output: AlienValue;
  records: ModelRecord[];
}

interface StagedMutation {
  mutation: RecordMutation;
  previous?: ModelRecord;
}

function unwrapRefValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(unwrapRefValue);
  if (
    typeof value === "object" &&
    value !== null &&
    !isPluginMarker(value) &&
    "$ref" in value &&
    "value" in value
  ) {
    return (value as { value: unknown }).value;
  }
  return value;
}

function unwrapRefs(values: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, unwrapRefValue(value)]),
  );
}

class TransactionEvents implements EventCollector {
  readonly values: DomainEvent[] = [];

  constructor(private readonly model: string) {}

  emit(topic: string, payload: AlienValue): void {
    if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(topic)) {
      throw new AppError(`事件 topic 不合法：${topic}`, 400);
    }
    this.values.push({
      id: crypto.randomUUID(),
      model: this.model,
      topic,
      payload,
      occurredAt: Date.now(),
    });
  }
}

function actionFor(operation: ModelWriteOperation): PermissionAction {
  return operation === "delete" ? "delete" : operation;
}

function lifecycleTopic(operation: ModelWriteOperation): string {
  return `record.${operation === "delete" ? "deleted" : `${operation}d`}`;
}

export class RecordService {
  constructor(
    private readonly models: CompiledModelProvider,
    private readonly records: RecordReader,
    private readonly transactions: UnitOfWork,
    private readonly refs: RecordExpander,
    private readonly access: AccessControl,
  ) {}

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

  private projectedModel(model: CompiledModel, schema: AlienSchema): CompiledModel {
    const fields = new Set(schema.fields.map((field) => field.key));
    return {
      ...model,
      schema,
      query: {
        fields: new Map([...model.query.fields].filter(([key]) => fields.has(key))),
      },
      validation: {
        fields: new Map([...model.validation.fields].filter(([key]) => fields.has(key))),
      },
    };
  }

  async list(input: ListInput, actorId: string): Promise<RecordListResult> {
    const model = await this.models.require(input.model);
    const profile = await this.access.profile(actorId);
    const scope = this.access.assertCan(profile, model.schema, "read");
    const schema = this.access.projectSchema(profile, model.schema);
    const runtimeModel = this.projectedModel(model, schema);
    const relation =
      input.parentId === undefined || input.parentId === null || input.parentId === ""
        ? undefined
        : this.selfRelation(schema);
    const result = await this.records.list(runtimeModel, {
      filter: input.filter,
      authId: actorId,
      pagination: input.pagination,
      sorter: input.sorter,
      keyword: input.keyword,
      searchFields: input.searchFields,
      parentId: input.parentId,
      idField: relation?.relation?.valueField ?? "id",
      parentField: relation?.key,
      ownerId: scope === "own" ? actorId : undefined,
    });
    const expanded = await this.refs.expand(schema, result.list);
    return {
      ...result,
      list: await Promise.all(
        expanded.map((record) =>
          presentModelRecord(
            runtimeModel,
            actorId,
            "list",
            this.access.project(profile, schema, record, runtimeModel.policy.privateFields),
          ),
        ),
      ),
    };
  }

  async options(input: OptionsInput, actorId: string): Promise<RecordOptionResult> {
    const model = await this.models.require(input.model);
    const profile = await this.access.profile(actorId);
    const scope = this.access.assertCan(profile, model.schema, "read");
    const schema = this.access.projectSchema(profile, model.schema);
    const runtimeModel = this.projectedModel(model, schema);
    const available = new Set(schema.fields.map((field) => field.key));
    if (
      !available.has(input.valueKey ?? "id") ||
      !available.has(input.labelKey ?? input.valueKey ?? "id")
    ) {
      throw forbidden("无权读取关联选项字段");
    }
    return this.records.options(runtimeModel, {
      valueKey: input.valueKey ?? "id",
      labelKey: input.labelKey ?? input.valueKey ?? "id",
      keyword: input.keyword,
      selectedValues: input.selectedValues,
      limit: input.limit,
      ownerId: scope === "own" ? actorId : undefined,
    });
  }

  async subtree(input: SubtreeInput, actorId: string): Promise<{ list: ModelRecord[] }> {
    const model = await this.models.require(input.model);
    const profile = await this.access.profile(actorId);
    const scope = this.access.assertCan(profile, model.schema, "read");
    const schema = this.access.projectSchema(profile, model.schema);
    const runtimeModel = this.projectedModel(model, schema);
    const list = await this.records.subtree(runtimeModel, {
      idField: input.idField ?? "id",
      parentField: input.parentField ?? "id",
      parentValue: input.parentValue,
      ownerId: scope === "own" ? actorId : undefined,
    });
    const expanded = await this.refs.expand(schema, list);
    return {
      list: await Promise.all(
        expanded.map((record) =>
          presentModelRecord(
            runtimeModel,
            actorId,
            "subtree",
            this.access.project(profile, schema, record, runtimeModel.policy.privateFields),
          ),
        ),
      ),
    };
  }

  async get(modelCode: string, id: string, actorId: string): Promise<ModelRecord> {
    const model = await this.models.require(modelCode);
    const profile = await this.access.profile(actorId);
    const scope = this.access.assertCan(profile, model.schema, "read");
    const record = await this.records.get(model, id);
    if (!record) throw notFound(`记录不存在：${id}`);
    await this.assertOwnership(scope, model, id, actorId);
    const expanded = await this.refs.expandOne(model.schema, record);
    return presentModelRecord(
      model,
      actorId,
      "get",
      this.access.project(profile, model.schema, expanded, model.policy.privateFields),
    );
  }

  async create(
    modelCode: string,
    values: Record<string, unknown>,
    actorId: string,
  ): Promise<ModelRecord> {
    const model = await this.models.require(modelCode);
    const profile = await this.access.profile(actorId);
    const events = new TransactionEvents(modelCode);
    const staged = await this.stageMutation(
      model,
      { operation: "create", values },
      actorId,
      profile,
      events,
    );
    await this.commit({ mutations: [staged.mutation], events: events.values });
    if (staged.mutation.operation === "delete") throw new Error("创建阶段生成了删除操作");
    return this.readCommitted(model, staged.mutation, profile, actorId, "create");
  }

  async update(
    modelCode: string,
    id: string,
    values: Record<string, unknown>,
    actorId: string,
  ): Promise<ModelRecord> {
    const model = await this.models.require(modelCode);
    const profile = await this.access.profile(actorId);
    const events = new TransactionEvents(modelCode);
    const staged = await this.stageMutation(
      model,
      { operation: "update", id, values },
      actorId,
      profile,
      events,
    );
    await this.commit({ mutations: [staged.mutation], events: events.values });
    if (staged.mutation.operation === "delete") throw new Error("更新阶段生成了删除操作");
    return this.readCommitted(model, staged.mutation, profile, actorId, "update");
  }

  async remove(modelCode: string, id: string, actorId: string): Promise<void> {
    const model = await this.models.require(modelCode);
    const profile = await this.access.profile(actorId);
    const existing = await this.records.get(model, id);
    if (!existing) return;
    const events = new TransactionEvents(modelCode);
    const staged = await this.stageMutation(
      model,
      { operation: "delete", id },
      actorId,
      profile,
      events,
    );
    await this.commit({ mutations: [staged.mutation], events: events.values });
  }

  async removeMany(modelCode: string, ids: string[], actorId: string): Promise<void> {
    const model = await this.models.require(modelCode);
    const profile = await this.access.profile(actorId);
    const events = new TransactionEvents(modelCode);
    const staged: StagedMutation[] = [];
    for (const id of ids) {
      if (!(await this.records.get(model, id))) continue;
      staged.push(
        await this.stageMutation(model, { operation: "delete", id }, actorId, profile, events),
      );
    }
    await this.commit({
      mutations: staged.map(({ mutation }) => mutation),
      events: events.values,
    });
  }

  async executeCommand(
    modelCode: string,
    commandCode: string,
    input: unknown,
    actorId: string,
  ): Promise<CommandExecutionResult> {
    const model = await this.models.require(modelCode);
    const command = model.commands[commandCode];
    if (!command) throw notFound(`模型命令不存在：${modelCode}.${commandCode}`);
    const profile = await this.access.profile(actorId);
    this.access.assertCan(profile, model.schema, command.permission);
    const result = await command.execute(input, {
      actorId,
      model: model.schema,
      models: this.models,
      records: this.records,
      now: Date.now(),
    });
    const allowed = new Set(["id", ...command.writeFields]);
    const events = new TransactionEvents(modelCode);
    for (const event of result.events ?? []) events.emit(event.topic, event.payload);

    const staged: StagedMutation[] = [];
    for (const mutation of result.mutations) {
      if (mutation.operation !== "delete") {
        for (const field of Object.keys(mutation.values)) {
          if (!allowed.has(field)) {
            throw new AppError(`命令 ${modelCode}.${commandCode} 未声明写入字段：${field}`, 500);
          }
        }
      }
      staged.push(await this.stageMutation(model, mutation, actorId, profile, events));
    }

    await this.commit({
      mutations: staged.map(({ mutation }) => mutation),
      events: events.values,
    });
    const records: ModelRecord[] = [];
    for (const { mutation } of staged) {
      if (mutation.operation === "delete") continue;
      records.push(await this.readCommitted(model, mutation, profile, actorId, "command"));
    }
    return { output: result.output ?? null, records };
  }

  private async stageMutation(
    model: CompiledModel,
    input: ModelCommandMutation,
    actorId: string,
    profile: AccessProfile,
    events: TransactionEvents,
  ): Promise<StagedMutation> {
    const action = actionFor(input.operation);
    const scope = this.access.assertCan(profile, model.schema, action);
    if (input.operation === "delete") {
      const previous = await this.records.get(model, input.id);
      if (!previous) throw notFound(`记录不存在：${input.id}`);
      await this.assertOwnership(scope, model, input.id, actorId);
      await runBeforePersist(this.models, this.records, model, actorId, "delete", previous, events);
      events.emit(lifecycleTopic("delete"), { id: input.id, actorId });
      return { mutation: { operation: "delete", model, id: input.id }, previous };
    }

    this.access.assertFields(profile, model.schema, action, Object.keys(input.values));
    const previous =
      input.operation === "update" ? await this.records.get(model, input.id) : undefined;
    if (input.operation === "update" && !previous) {
      throw notFound(`记录不存在：${input.id}`);
    }
    const ownerId =
      input.operation === "update"
        ? await this.assertOwnership(scope, model, input.id, actorId)
        : actorId;
    const prepared = await prepareModelInput(
      model,
      unwrapRefs(input.values),
      actorId,
      input.operation,
      previous,
    );
    const id =
      input.operation === "update"
        ? input.id
        : typeof prepared.id === "string" && prepared.id
          ? prepared.id
          : await this.records.allocateId();
    const candidate = normalizeRecord(model, { ...previous, ...prepared, id });
    await validateModelRecord(
      this.models,
      this.records,
      model,
      candidate,
      actorId,
      input.operation,
      previous,
    );
    await runBeforePersist(
      this.models,
      this.records,
      model,
      actorId,
      input.operation,
      candidate,
      events,
      previous,
    );
    events.emit(lifecycleTopic(input.operation), { id, actorId });
    return {
      mutation:
        input.operation === "create"
          ? { operation: "create", model, record: candidate, ownerId: actorId }
          : {
              operation: "update",
              model,
              id,
              record: candidate,
              ownerId,
            },
      previous,
    };
  }

  private async commit(plan: TransactionPlan): Promise<void> {
    try {
      await this.transactions.commit(plan);
    } catch (reason) {
      if (reason instanceof Error && reason.message.includes("UNIQUE constraint failed")) {
        throw conflict("唯一字段值已存在");
      }
      throw reason;
    }
  }

  private async readCommitted(
    model: CompiledModel,
    mutation: Exclude<RecordMutation, { operation: "delete" }>,
    profile: AccessProfile,
    actorId: string,
    operation: "create" | "update" | "command",
  ): Promise<ModelRecord> {
    const record = await this.records.get(model, mutation.record.id);
    if (!record) throw new Error(`记录提交后无法读取：${mutation.record.id}`);
    const expanded = await this.refs.expandOne(model.schema, record);
    return presentModelRecord(
      model,
      actorId,
      operation,
      this.access.project(profile, model.schema, expanded, model.policy.privateFields),
    );
  }

  private async assertOwnership(
    scope: PermissionScope,
    model: CompiledModel,
    id: string,
    actorId: string,
  ): Promise<string | undefined> {
    const ownerId = await this.records.owner(model, id);
    if (scope === "own" && ownerId !== actorId) throw forbidden("无权访问其他用户创建的数据");
    return ownerId;
  }
}
