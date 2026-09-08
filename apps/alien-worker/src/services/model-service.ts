import { parseModelSchema, type ModelSchema, type ModelSummary } from "@alien-form/protocol";
import { compileMigrationPlan } from "../domain/storage-compiler.ts";
import { badRequest, conflict, notFound } from "../errors.ts";
import { ModelVersionConflictError, type ModelStore } from "../store/model-store.ts";

export class ModelService {
  constructor(private readonly models: ModelStore) {}

  list(): Promise<ModelSummary[]> {
    return this.models.list();
  }

  async get(name: string): Promise<ModelSchema> {
    const model = await this.models.get(name);
    if (!model) throw notFound(`模型不存在：${name}`);
    return model;
  }

  async create(value: unknown): Promise<ModelSchema> {
    const incoming = this.parse(value);
    if (incoming.version !== 0) throw conflict("新模型 version 必须为 0");
    if (await this.models.has(incoming.name)) throw conflict(`模型已存在：${incoming.name}`);
    return this.publish(undefined, incoming);
  }

  async update(name: string, value: unknown): Promise<ModelSchema> {
    const incoming = this.parse(value);
    if (incoming.name !== name) throw conflict("模型 name 与请求路径不一致");
    const current = await this.models.get(name);
    if (!current) throw notFound(`模型不存在：${name}`);
    if (incoming.version !== current.version) {
      throw conflict(`模型版本冲突：当前 ${current.version}，提交 ${incoming.version}`);
    }
    return this.publish(current, incoming);
  }

  async publish(current: ModelSchema | undefined, incoming: ModelSchema): Promise<ModelSchema> {
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

  private parse(value: unknown): ModelSchema {
    try {
      return parseModelSchema(value);
    } catch (reason) {
      throw badRequest(reason instanceof Error ? reason.message : String(reason));
    }
  }
}
