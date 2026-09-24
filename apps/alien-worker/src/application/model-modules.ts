import { MODEL_MODULE_LOADERS } from "./model-manifest.generated.ts";
import type { ModelModule } from "@alien-form/alienbase";

type ModelModuleImport = { default: ModelModule };
type ModelModuleImporter = (modelCode: string) => Promise<ModelModuleImport>;

const generatedModelCodes = Object.keys(MODEL_MODULE_LOADERS);

async function importModelModule(modelCode: string): Promise<ModelModuleImport> {
  const loader = MODEL_MODULE_LOADERS[modelCode as keyof typeof MODEL_MODULE_LOADERS];
  if (!loader) throw new Error(`未知模型模块：${modelCode}`);
  return loader();
}

/** Resolves convention-based model modules and caches their immutable definitions. */
export class ModelModules {
  private readonly cache = new Map<string, Promise<ModelModule | undefined>>();

  constructor(
    private readonly modelCodes: readonly string[] = generatedModelCodes,
    private readonly importer: ModelModuleImporter = importModelModule,
  ) {}

  static from(modules: readonly ModelModule[]): ModelModules {
    const byCode = new Map(modules.map((module) => [module.schema.name, module]));
    return new ModelModules([...byCode.keys()], async (modelCode) => {
      const module = byCode.get(modelCode);
      if (!module) throw new Error(`未知模型模块：${modelCode}`);
      return { default: module };
    });
  }

  has(modelCode: string): boolean {
    return this.modelCodes.includes(modelCode);
  }

  async get(modelCode: string): Promise<ModelModule | undefined> {
    if (!this.has(modelCode)) return undefined;
    let pending = this.cache.get(modelCode);
    if (!pending) {
      pending = this.importer(modelCode).then(({ default: module }) => {
        if (module.schema.name !== modelCode) {
          throw new Error(`模型目录名与 AlienSchema.name 不一致：${modelCode}`);
        }
        return module;
      });
      this.cache.set(modelCode, pending);
    }
    return pending;
  }

  async entries(): Promise<readonly ModelModule[]> {
    return Promise.all(this.modelCodes.map(async (modelCode) => (await this.get(modelCode))!));
  }
}

export const modelModules = new ModelModules();
