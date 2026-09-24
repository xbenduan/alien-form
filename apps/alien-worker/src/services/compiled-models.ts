import { notFound } from "../errors.ts";
import { compileModel } from "../storage/model-compiler.ts";
import type { CompiledModel, CompiledModelProvider, ModelRepository } from "./core/contracts.ts";
import type { ModelModules } from "./model-modules.ts";

/** Resolves and caches immutable runtime plans by `model@version`. */
export class CompiledModels implements CompiledModelProvider {
  private readonly cache = new Map<string, CompiledModel>();

  constructor(
    private readonly models: ModelRepository,
    private readonly modules: ModelModules,
  ) {}

  async get(modelCode: string): Promise<CompiledModel | undefined> {
    const schema = await this.models.get(modelCode);
    if (!schema) return undefined;
    const key = `${schema.name}@${schema.version}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const module = await this.modules.get(modelCode);
    const compiled: CompiledModel = Object.freeze({
      ...compileModel(schema),
      lifecycle: module?.middleware,
      commands: Object.freeze({ ...module?.commands }),
      eventHandlers: Object.freeze({ ...module?.events }),
    });
    this.cache.set(key, compiled);
    return compiled;
  }

  async require(modelCode: string): Promise<CompiledModel> {
    const model = await this.get(modelCode);
    if (!model) throw notFound(`未知模型：${modelCode}`);
    return model;
  }

  invalidate(modelCode: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${modelCode}@`)) this.cache.delete(key);
    }
  }

  isCodeModel(modelCode: string): boolean {
    return this.modules.has(modelCode);
  }
}
