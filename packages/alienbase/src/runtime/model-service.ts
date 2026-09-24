import { parseAlienSchema, type AlienSchema, type ModelSummary } from "@alien-form/protocol";
import { badRequest, conflict, forbidden, notFound } from "../errors.ts";
import type { AccessControl } from "./access-control.ts";
import {
  ModelVersionConflictError,
  type CompiledModelProvider,
  type ModelRepository,
} from "./contracts.ts";

/** 模型分类约束端口，由组合根注入具体分类模型实现。 */
export interface ModelGroupPolicy {
  /** 校验分类存在且可用于归类。 */
  assertValid(group: string | undefined): Promise<void>;
}

export class ModelService {
  constructor(
    private readonly models: ModelRepository,
    private readonly access: AccessControl,
    private readonly compiledModels: CompiledModelProvider,
    private readonly groups: ModelGroupPolicy,
  ) {}

  async list(actorId: string): Promise<ModelSummary[]> {
    const [models, profile] = await Promise.all([this.models.list(), this.access.profile(actorId)]);
    return models
      .map((model) => ({ ...model, system: this.isSystem(model.name) }))
      .filter((model) => this.access.canRead(profile, model));
  }

  async get(name: string, actorId: string): Promise<AlienSchema> {
    const model = await this.models.get(name);
    if (!model) throw notFound(`模型不存在：${name}`);
    const profile = await this.access.profile(actorId);
    this.access.assertCan(profile, model, "read");
    return {
      ...this.access.projectSchema(profile, model),
      system: this.isSystem(name),
    };
  }

  async create(value: unknown, actorId: string): Promise<AlienSchema> {
    this.access.assertCanCreateModel(await this.access.profile(actorId));
    const incoming = this.parse({
      ...(value as object),
      system: false,
      systemRevision: undefined,
      creatorId: actorId,
    });
    await this.groups.assertValid(incoming.group);
    if (incoming.version !== 0) throw conflict("新模型 version 必须为 0");
    if (await this.models.has(incoming.name)) throw conflict(`模型已存在：${incoming.name}`);
    return this.publish(undefined, incoming);
  }

  async update(name: string, value: unknown, actorId: string): Promise<AlienSchema> {
    if (this.isSystem(name)) throw forbidden("系统模型禁止修改");
    const submitted = this.parse(value);
    const current = await this.models.get(name);
    if (!current) throw notFound(`模型不存在：${name}`);
    this.access.assertCanManageModel(await this.access.profile(actorId), current);
    const incoming = this.parse({
      ...submitted,
      system: false,
      systemRevision: undefined,
      creatorId: current.creatorId,
    });
    if (incoming.name !== name) throw conflict("模型 name 与请求路径不一致");
    await this.groups.assertValid(incoming.group);
    if (incoming.version !== current.version) {
      throw conflict(`模型版本冲突：当前 ${current.version}，提交 ${incoming.version}`);
    }
    return this.publish(current, incoming);
  }

  async remove(name: string, actorId: string): Promise<void> {
    if (this.isSystem(name)) throw forbidden("系统模型禁止删除");
    const current = await this.models.get(name);
    if (!current) return;
    this.access.assertCanManageModel(await this.access.profile(actorId), current);
    await this.models.delete(current);
    this.compiledModels.invalidate(name);
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
    try {
      const published = await this.models.publish(current, schema, current?.version ?? 0);
      this.compiledModels.invalidate(schema.name);
      return published;
    } catch (reason) {
      if (reason instanceof ModelVersionConflictError) {
        throw conflict(`模型版本冲突：当前模型已被其他请求更新，请重新获取 ${schema.name}`);
      }
      throw badRequest(reason instanceof Error ? reason.message : String(reason));
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
    return this.compiledModels.isCodeModel(name);
  }
}
