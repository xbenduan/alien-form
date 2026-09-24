import type {
  CodeModelCatalog,
  ModelDefinition,
  SchemaModelDefinition,
} from "@alien-form/alienbase";
import type { AlienSchema } from "@alien-form/protocol";

type ModelModuleImport = { default: ModelDefinition };
export type ModelModuleLoaders = Readonly<Record<string, () => Promise<ModelModuleImport>>>;

function ownsSchema(definition: ModelDefinition): definition is SchemaModelDefinition {
  return definition.schema !== undefined;
}

/** 解析 Core 静态声明的模型定义，并按协议组合所有匹配行为。 */
export class ModelModules implements CodeModelCatalog {
  private definitions?: Promise<readonly ModelDefinition[]>;

  constructor(private readonly loaders: ModelModuleLoaders) {}

  static from(definitions: readonly ModelDefinition[]): ModelModules {
    return new ModelModules(
      Object.fromEntries(
        definitions.map((definition, index) => [
          String(index),
          async () => ({ default: definition }),
        ]),
      ),
    );
  }

  async has(modelCode: string): Promise<boolean> {
    return !!(await this.schema(modelCode));
  }

  async schema(modelCode: string): Promise<AlienSchema | undefined> {
    return (await this.entries())
      .filter(ownsSchema)
      .map((definition) => definition.schema)
      .find(({ name }) => name === modelCode);
  }

  async matching(schema: AlienSchema): Promise<readonly ModelDefinition[]> {
    const definitions = await this.entries();
    const matched = definitions.filter(
      (definition) => definition.match && definition.match({ schema }),
    );
    const exact = definitions.filter((definition) => {
      if (definition.schema) return definition.schema.name === schema.name;
      return definition.name === schema.name;
    });
    return [...matched, ...exact];
  }

  async entries(): Promise<readonly ModelDefinition[]> {
    if (!this.definitions) {
      this.definitions = Promise.all(
        Object.values(this.loaders).map(async (load) => (await load()).default),
      ).then((definitions) => {
        const schemas = definitions.filter(ownsSchema).map((definition) => definition.schema);
        const names = new Set<string>();
        for (const schema of schemas) {
          if (names.has(schema.name)) throw new Error(`代码模型重复定义：${schema.name}`);
          names.add(schema.name);
        }
        return definitions;
      });
    }
    return this.definitions;
  }

  /** 只返回真正由代码持有的 Schema；纯行为定义不占用模型名。 */
  async list(): Promise<readonly AlienSchema[]> {
    return (await this.entries()).filter(ownsSchema).map((definition) => definition.schema);
  }
}
