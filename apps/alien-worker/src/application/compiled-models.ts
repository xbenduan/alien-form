import { notFound } from "@alien-form/alienbase";
import type {
  CompiledModel,
  CompiledModelProvider,
  ModelCommand,
  ModelDefinition,
  ModelEventHandler,
  ModelMiddleware,
  ModelRepository,
} from "@alien-form/alienbase";
import type { AlienSchema } from "@alien-form/protocol";
import type { ModelModules } from "./model-modules.ts";

export type ModelCompiler = (
  schema: AlienSchema,
) => Omit<CompiledModel, "lifecycle" | "commands" | "eventHandlers">;

function composeMiddleware(definitions: readonly ModelDefinition[]): ModelMiddleware | undefined {
  const middleware = definitions.flatMap((definition) =>
    definition.middleware ? [definition.middleware] : [],
  );
  if (middleware.length === 0) return undefined;
  const composed: ModelMiddleware = {
    async prepare(values, context) {
      let current = { ...values };
      for (const item of middleware) {
        if (item.prepare) current = await item.prepare(Object.freeze(current), context);
      }
      return current;
    },
    async validate(context) {
      for (const item of middleware) await item.validate?.(context);
    },
    async beforePersist(context) {
      for (const item of middleware) await item.beforePersist?.(context);
    },
    async present(record, context) {
      let current = { ...record };
      for (const item of middleware) {
        if (item.present) current = await item.present(Object.freeze(current), context);
      }
      return current;
    },
  };
  return Object.freeze(composed);
}

function composeCommands(
  schema: AlienSchema,
  definitions: readonly ModelDefinition[],
): Readonly<Record<string, ModelCommand>> {
  const commands: Record<string, ModelCommand> = {};
  for (const definition of definitions) {
    for (const [name, command] of Object.entries(definition.commands ?? {})) {
      if (Object.hasOwn(commands, name)) {
        throw new Error(`模型 ${schema.name} 的 Command 重复定义：${name}`);
      }
      commands[name] = command;
    }
  }
  return Object.freeze(commands);
}

function composeEventHandlers(
  definitions: readonly ModelDefinition[],
): Readonly<Record<string, ModelEventHandler>> {
  const consumers = new Map<string, ModelEventHandler[]>();
  for (const definition of definitions) {
    for (const [topic, handler] of Object.entries(definition.events ?? {})) {
      const handlers = consumers.get(topic) ?? [];
      handlers.push(handler);
      consumers.set(topic, handlers);
    }
  }
  return Object.freeze(
    Object.fromEntries(
      [...consumers].map(([topic, handlers]) => [
        topic,
        async (...args: Parameters<ModelEventHandler>) => {
          for (const handler of handlers) await handler(...args);
        },
      ]),
    ),
  );
}

/** Resolves and caches immutable runtime plans by `model@version`. */
export class CompiledModels implements CompiledModelProvider {
  private readonly cache = new Map<string, CompiledModel>();

  constructor(
    private readonly models: ModelRepository,
    private readonly modules: ModelModules,
    private readonly compile: ModelCompiler,
  ) {}

  async get(modelCode: string): Promise<CompiledModel | undefined> {
    const schema = (await this.modules.schema(modelCode)) ?? (await this.models.get(modelCode));
    if (!schema) return undefined;
    const key = `${schema.name}@${schema.version}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const definitions = await this.modules.matching(schema);
    const compiled: CompiledModel = Object.freeze({
      ...this.compile(schema),
      lifecycle: composeMiddleware(definitions),
      commands: composeCommands(schema, definitions),
      eventHandlers: composeEventHandlers(definitions),
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
}
