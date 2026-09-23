import { parseAlienSchema, type AlienSchema, type ModelSummary } from "@alien-form/protocol";
import { compileMigrationPlan } from "../domain/storage-compiler.ts";
import { SYS_MODEL_CATEGORY_MODEL } from "../domain/schemas/_sys_model_category.ts";
import { badRequest, conflict, forbidden, notFound } from "../errors.ts";
import type { ModelRegistry } from "../register/index.ts";
import { ModelVersionConflictError, type ModelStore } from "../store/model-store.ts";
import type { RecordStore } from "../store/record-store.ts";
import type { AuthorizationService } from "./authorization-service.ts";

export class ModelService {
  constructor(
    private readonly models: ModelStore,
    private readonly records: RecordStore,
    private readonly authorization: AuthorizationService,
    private readonly registry: ModelRegistry,
  ) {}

  async list(actorId: string): Promise<ModelSummary[]> {
    const [models, profile] = await Promise.all([
      this.models.list(),
      this.authorization.profile(actorId),
    ]);
    return models
      .map((model) => ({ ...model, system: this.isSystem(model.name) }))
      .filter((model) => this.authorization.canRead(profile, model));
  }

  async get(name: string, actorId: string): Promise<AlienSchema> {
    const model = await this.models.get(name);
    if (!model) throw notFound(`模型不存在：${name}`);
    const profile = await this.authorization.profile(actorId);
    this.authorization.assertCan(profile, model, "read");
    return {
      ...this.authorization.projectSchema(profile, model),
      system: this.isSystem(name),
    };
  }

  async create(value: unknown, actorId: string): Promise<AlienSchema> {
    this.authorization.assertCanCreateModel(await this.authorization.profile(actorId));
    const incoming = this.parse({
      ...(value as object),
      system: false,
      systemRevision: undefined,
      creatorId: actorId,
    });
    await this.assertGroup(incoming.group);
    if (incoming.version !== 0) throw conflict("新模型 version 必须为 0");
    if (await this.models.has(incoming.name)) throw conflict(`模型已存在：${incoming.name}`);
    return this.publish(undefined, incoming);
  }

  async update(name: string, value: unknown, actorId: string): Promise<AlienSchema> {
    if (this.isSystem(name)) throw forbidden("系统模型禁止修改");
    const submitted = this.parse(value);
    const current = await this.models.get(name);
    if (!current) throw notFound(`模型不存在：${name}`);
    this.authorization.assertCanManageModel(await this.authorization.profile(actorId), current);
    const incoming = this.parse({
      ...submitted,
      system: false,
      systemRevision: undefined,
      creatorId: current.creatorId,
    });
    if (incoming.name !== name) throw conflict("模型 name 与请求路径不一致");
    await this.assertGroup(incoming.group);
    if (incoming.version !== current.version) {
      throw conflict(`模型版本冲突：当前 ${current.version}，提交 ${incoming.version}`);
    }
    return this.publish(current, incoming);
  }

  async remove(name: string, actorId: string): Promise<void> {
    if (this.isSystem(name)) throw forbidden("系统模型禁止删除");
    const current = await this.models.get(name);
    if (!current) return;
    this.authorization.assertCanManageModel(await this.authorization.profile(actorId), current);
    await this.models.delete(current);
  }

  /** Installs or upgrades a code-owned system schema during bootstrap. */
  async ensureSystemModel(value: AlienSchema): Promise<AlienSchema> {
    const desired = this.parse({ ...value, system: true, creatorId: undefined });
    const current = await this.models.get(desired.name);
    if (!current) return this.publish(undefined, { ...desired, version: 0 });
    if ((current.systemRevision ?? 0) >= (desired.systemRevision ?? 0)) {
      return current;
    }
    return this.publish(current, this.parse({ ...desired, version: current.version }));
  }

  private async publish(
    current: AlienSchema | undefined,
    incoming: AlienSchema,
  ): Promise<AlienSchema> {
    const schema = this.parse({
      ...incoming,
      version: (current?.version ?? 0) + 1,
    });
    let compiled: ReturnType<typeof compileMigrationPlan>;
    try {
      compiled = compileMigrationPlan(current, schema);
    } catch (reason) {
      throw badRequest(reason instanceof Error ? reason.message : String(reason));
    }
    const { manifest, plan } = compiled;
    try {
      return await this.models.publish(schema, manifest.table, plan, current?.version ?? 0);
    } catch (reason) {
      if (reason instanceof ModelVersionConflictError) {
        throw conflict(`模型版本冲突：当前模型已被其他请求更新，请重新获取 ${schema.name}`);
      }
      throw reason;
    }
  }

  private parse(value: unknown): AlienSchema {
    try {
      return parseAlienSchema(value);
    } catch (reason) {
      throw badRequest(reason instanceof Error ? reason.message : String(reason));
    }
  }

  private isSystem(name: string): boolean {
    return this.registry.get(name)?.schema !== undefined;
  }

  private async assertGroup(group: string | undefined): Promise<void> {
    if (!group) throw badRequest("模型必须选择一个分类");
    const categorySchema = await this.models.get(SYS_MODEL_CATEGORY_MODEL);
    if (!categorySchema) throw badRequest("分类标签尚未初始化");
    const category = await this.records.findByField(categorySchema, "code", group);
    if (!category || category.aggregate === true) {
      throw badRequest(`分类标签不存在或不可用于归类：${group}`);
    }
  }
}
