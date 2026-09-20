import { registerSysUser } from "./models/_sys_user.ts";
import { registerSysRole } from "./models/_sys_role.ts";
import { registerSysModelTab } from "./models/_sys_model_tab.ts";
import { ModelRegistry } from "./registry.ts";

export { ModelRegistry } from "./registry.ts";
export type {
  ModelFieldValidator,
  ModelInputTransformer,
  ModelLifecycleContext,
  ModelLifecycleHook,
  ModelLifecycleHooks,
  ModelRecordValidator,
  ModelRegistration,
  ModelTransformContext,
  ModelValidationContext,
} from "./registry.ts";

export function registerAll(registry: ModelRegistry): void {
  registerSysRole(registry);
  registerSysModelTab(registry);
  registerSysUser(registry);
}

export function createModelRegistry(): ModelRegistry {
  const registry = new ModelRegistry();
  registerAll(registry);
  registry.freeze();
  return registry;
}

export const modelRegistry = createModelRegistry();
