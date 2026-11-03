import { FormworkError } from "../model/errors";
import type {
  DomainDefinition,
  FormworkApplication,
  FormworkDefinition,
  PageDefinition,
} from "./types";

function validateRoute(definition: DomainDefinition | PageDefinition) {
  if (!/^[a-z][a-z0-9-]*$/u.test(definition.router) || typeof definition.render !== "function")
    throw new FormworkError("INVALID_DEFINITION", "router 必须是小写路径段，render 必须是函数");
}
/** 定义模型 Domain；实际地址为 /router/:modelId。 */
export function defineDomain(definition: DomainDefinition): DomainDefinition {
  validateRoute(definition);
  return definition;
}
/** 定义普通 Page；实际地址为 /router，额外参数放入 query。 */
export function definePage(definition: PageDefinition): PageDefinition {
  validateRoute(definition);
  return definition;
}
/** 校验并保存应用声明，无需构建插件或 JSX 源码转换。 */
export function defineFormwork(definition: FormworkDefinition): FormworkApplication {
  if (!Array.isArray(definition.domains) || !Array.isArray(definition.pages))
    throw new FormworkError("INVALID_DEFINITION", "必须显式提供 domains 和 pages 数组");
  const registered = new Set<string>();
  for (const route of [...definition.domains, ...definition.pages]) {
    validateRoute(route);
    if (registered.has(route.router))
      throw new FormworkError("DUPLICATE_ROUTE", `重复 router ${route.router}`);
    registered.add(route.router);
  }
  const visit = (value: unknown, key = "") => {
    if (typeof value === "string" && key !== "props" && !definition.components[value])
      throw new FormworkError("UNKNOWN_COMPONENT", `app.ui 引用了未注册组件 ${value}`);
    if (value && typeof value === "object" && key !== "props")
      for (const [name, child] of Object.entries(value)) visit(child, name);
  };
  visit(definition.ui);
  return Object.freeze({ ...definition });
}
