import { FormworkError } from "../model/errors";
import { mergeRegistry } from "../model/definition-policy";
import type { ActionContext, DomainDefinition, FormworkDefinition, RenderDefaults } from "./types";

/** 合并具名组件和行为，fieldContainer 使用最近定义。 */
export function mergeDefaults(...layers: RenderDefaults[]): RenderDefaults {
  return {
    components: mergeRegistry(...layers.map((layer) => layer.components)),
    fn: mergeRegistry(...layers.map((layer) => layer.fn)),
    fieldContainer: layers.findLast((layer) => layer.fieldContainer !== undefined)?.fieldContainer,
  };
}

/** 只加载选中的 Domain，导入失败保留原始错误供实例重试。 */
export async function resolveDomain(app: FormworkDefinition, name?: string): Promise<DomainDefinition> {
  if (name === undefined) return {};
  const entry = app.domains?.[name];
  if (!entry || !Object.hasOwn(app.domains!, name))
    throw new FormworkError("UNKNOWN_DOMAIN", `Domain 未注册: ${name}`);
  const definition = typeof entry === "function" ? (await entry()).default : entry;
  if (!definition || typeof definition !== "object")
    throw new FormworkError("INVALID_DOMAIN", `Domain 导出无效: ${name}`);
  return definition;
}

/** 将未绑定的声明绑定到当前实例，销毁后拒绝继续调用。 */
export function bindFunctions(defaults: RenderDefaults, ctx: ActionContext): void {
  ctx.fn = Object.fromEntries(Object.entries(defaults.fn ?? {}).map(([name, fn]) => [
    name,
    (...args: unknown[]) => {
      if (ctx.signal.aborted) throw new FormworkError("ABORTED", "Instance 已销毁");
      return fn(ctx, ...args);
    },
  ]));
}
