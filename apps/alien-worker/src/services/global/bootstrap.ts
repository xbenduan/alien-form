import type { Container } from "../../container.ts";

/** Prepares, publishes, and initializes every convention-loaded model module. */
export async function ensureModelModules(container: Container): Promise<void> {
  const modules = await container.modules.entries();
  for (const module of modules) await module.database?.prepare?.(container);
  for (const module of modules) await container.modelService.ensureSystemModel(module.schema);
  for (const module of modules) await module.database?.initialize?.(container);
}
