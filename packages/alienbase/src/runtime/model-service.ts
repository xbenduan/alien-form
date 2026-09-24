import { parseAlienSchema, type AlienSchema, type ModelSummary } from "@alien-form/protocol";
import { badRequest, conflict, forbidden, notFound } from "../errors.ts";
import type { AccessControl } from "./access-control.ts";
import {
  type CodeModelCatalog,
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
    private readonly codeModels: CodeModelCatalog,
    private readonly access: AccessControl,
    private readonly compiledModels: CompiledModelProvider,
    private readonly groups: ModelGroupPolicy,
  ) {}

  async list(actorId: string): Promise<ModelSummary[]> {
    const [storedModels, codeSchemas, profile] = await Promise.all([
      this.models.list(),
      this.codeModels.list(),
      this.access.profile(actorId),
    ]);
    const codeModels = codeSchemas.map((schema) => this.summarize(schema));
    const codeModelNames = new Set(codeSchemas.map(({ name }) => name));
    return [
      ...codeModels,
      ...storedModels.filter((model) => !codeModelNames.has(model.name)),
    ].filter((model) => this.access.canRead(profile, model));
  }

  async get(name: string, actorId: string): Promise<AlienSchema> {
    const compiled = await this.compiledModels.get(name);
    if (!compiled) throw notFound(`模型不存在：${name}`);
    const model = compiled.schema;
    const profile = await this.access.profile(actorId);
    this.access.assertCan(profile, model, "read");
    return {
      ...this.access.projectSchema(profile, model),
      system: await this.codeModels.has(name),
    };
  }

  async create(value: unknown, actorId: string): Promise<AlienSchema> {
    this.access.assertCanCreateModel(await this.access.profile(actorId));
    const incoming = this.parse({
      ...(value as object),
      system: false,
      creatorId: actorId,
    });
    await this.groups.assertValid(incoming.group);
    if (incoming.version !== 0) throw conflict("新模型 version 必须为 0");
    if ((await this.codeModels.has(incoming.name)) || (await this.models.has(incoming.name))) {
      throw conflict(`模型已存在：${incoming.name}`);
    }
    return this.publish(undefined, incoming);
  }

  async update(name: string, value: unknown, actorId: string): Promise<AlienSchema> {
    if (await this.codeModels.has(name)) throw forbidden("系统模型禁止修改");
    const submitted = this.parse(value);
    const current = await this.models.get(name);
    if (!current) throw notFound(`模型不存在：${name}`);
    this.access.assertCanManageModel(await this.access.profile(actorId), current);
    const incoming = this.parse({
      ...submitted,
      system: false,
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
    if (await this.codeModels.has(name)) throw forbidden("系统模型禁止删除");
    const current = await this.models.get(name);
    if (!current) return;
    this.access.assertCanManageModel(await this.access.profile(actorId), current);
    await this.models.delete(current);
    this.compiledModels.invalidate(name);
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

  private summarize(schema: AlienSchema): ModelSummary {
    return {
      name: schema.name,
      title: schema.title,
      version: schema.version,
      system: true,
      subtitle: schema.subtitle,
      description: schema.description,
      group: schema.group,
      singularLabel: schema.singularLabel,
      pluralLabel: schema.pluralLabel,
      defaultPageSize: schema.defaultPageSize,
      fieldCount: schema.fields.length,
    };
  }
}
