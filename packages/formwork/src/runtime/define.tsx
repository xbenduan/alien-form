import { Router, Route } from "@solidjs/router";
import { FormworkError } from "../model/errors";
import { validateRoutes } from "../model/routes";
import { Host } from "../router/host";
import type { DomainDefinition, FormworkApplication, FormworkDefinition, PageAuthorDefinition, PageDefinition, WindowAuthorDefinition, WindowDefinition } from "./types";

function assertBody(definition: PageAuthorDefinition) {
  if (definition.render !== undefined && (Object.hasOwn(definition, "schema") || Object.hasOwn(definition, "getSchema") || Object.hasOwn(definition, "container") || Object.hasOwn(definition, "fieldContainer")))
    throw new FormworkError("INVALID_DEFINITION", "普通 render 与 schema 内容互斥");
  if (definition.render !== undefined && typeof definition.render !== "function") throw new FormworkError("INVALID_DEFINITION", "直接 JSX render 需要 formworkPlugin 转换");
}
/** 保存一个可寻址页面，状态在挂载时创建。 */
export function definePage(definition: PageDefinition | PageAuthorDefinition): PageDefinition {
  assertBody(definition);
  return definition as PageDefinition;
}
/** 保存固定 presentation 和 returnTo 的 Window。 */
export function defineWindow(definition: WindowDefinition | WindowAuthorDefinition): WindowDefinition {
  assertBody(definition);
  if (!["page", "modal", "drawer"].includes(definition.presentation)) throw new FormworkError("INVALID_DEFINITION", "Window presentation 无效");
  return definition as WindowDefinition;
}
/** 保存指定模型的稀疏覆盖，不创建 owner 或请求。 */
export function defineDomain(definition: DomainDefinition): DomainDefinition { return definition; }
/** 装配应用；每次 render 在当前 Solid owner 下创建独立 Host。 */
export function defineFormwork(definition: FormworkDefinition): FormworkApplication {
  validateRoutes([...definition.pages, ...definition.windows ?? []]);
  for (const page of [...definition.pages, ...definition.windows ?? []]) {
    assertBody(page);
    if (!page.render && !page.container && !definition.container && !page.domains) throw new FormworkError("INVALID_DEFINITION", `缺少 container: ${page.router}`);
    if ("presentation" in page && !definition.presenters[(page as WindowDefinition).presentation]) throw new FormworkError("INVALID_DEFINITION", `缺少 ${page.presentation} Presenter`);
  }
  return { render: () => <Router root={() => <Host app={definition} />}><Route path="*" component={() => null} /></Router> };
}
