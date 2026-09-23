import type { Container } from "../container.ts";

/** Creates a record with a stable ID only when it does not already exist. */
export async function ensureRecord(
  container: Container,
  model: string,
  id: string,
  values: Record<string, unknown>,
  actorId: string,
): Promise<void> {
  const schema = await container.modelStore.get(model);
  if (!schema) throw new Error(`内置模型未发布：${model}`);
  if (await container.recordStore.get(schema, id)) return;
  await container.recordService.create(model, { id, ...values }, actorId);
}

/** Prepares, publishes, and initializes every convention-loaded model module. */
export async function ensureModelModules(container: Container): Promise<void> {
  const modules = await container.modules.entries();
  for (const module of modules) await module.database?.prepare?.(container);
  for (const module of modules) await container.modelService.ensureSystemModel(module.schema);
  for (const module of modules) await module.database?.initialize?.(container);
}
