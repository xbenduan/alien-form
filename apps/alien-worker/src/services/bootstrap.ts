import type { Container } from "../container.ts";
import type { ModelDatabaseContext } from "./define-model.ts";

/** Creates a record with a stable ID only when it does not already exist. */
export async function ensureRecord(
  context: ModelDatabaseContext,
  model: string,
  id: string,
  values: Record<string, unknown>,
  actorId: string,
): Promise<void> {
  const compiled = await context.models.get(model);
  if (!compiled) throw new Error(`内置模型未发布：${model}`);
  if (await context.records.get(compiled, id)) return;
  await context.create(model, { id, ...values }, actorId);
}

/** Prepares, publishes, and initializes every convention-loaded model module. */
export async function ensureModelModules(container: Container): Promise<void> {
  const modules = await container.modules.entries();
  for (const module of modules) await container.modelService.ensureSystemModel(module.schema);
  const context: ModelDatabaseContext = {
    models: container.compiledModels,
    records: container.recordStore,
    create: (model, values, actorId) => container.recordService.create(model, values, actorId),
    update: (model, id, values, actorId) =>
      container.recordService.update(model, id, values, actorId),
  };
  for (const module of modules) await module.database?.initialize?.(context);
}

/**
 * 创建 isolate 级模型初始化协调器。
 *
 * 首批并发请求共享同一个初始化 Promise；初始化失败后清除缓存，使后续请求可以重试。
 */
export function createModelModulesBootstrap(): (container: Container) => Promise<void> {
  let initialization: Promise<void> | undefined;

  return async (container) => {
    if (!initialization) {
      initialization = ensureModelModules(container).catch((reason: unknown) => {
        initialization = undefined;
        throw reason;
      });
    }
    await initialization;
  };
}
