import { registerSysUser } from "./models/_sys_user.ts";
import { ModelRegistry } from "./registry.ts";

export { ModelRegistry } from "./registry.ts";
export type {
  ModelFieldValidator,
  ModelLifecycleContext,
  ModelLifecycleHook,
  ModelLifecycleHooks,
  ModelRecordValidator,
  ModelRegistration,
  ModelValidationContext,
} from "./registry.ts";

export function registerAll(registry: ModelRegistry): void {
  registerSysUser(registry);
}

export function createModelRegistry(): ModelRegistry {
  const registry = new ModelRegistry();
  registerAll(registry);
  registry.freeze();
  return registry;
}

export const modelRegistry = createModelRegistry();
