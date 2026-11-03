import { Router, Route } from "@solidjs/router";
import { FormworkError } from "../model/errors";
import { createRoutes } from "../model/routes";
import { Host } from "../router/host";
import type {
  DomainDefinition,
  FormworkApplication,
  FormworkDefinition,
  PageAuthorDefinition,
  PageDefinition,
  WindowAuthorDefinition,
  WindowDefinition,
} from "./types";

function assertBody(definition: PageAuthorDefinition | WindowAuthorDefinition) {
  if (
    definition.render !== undefined &&
    (Object.hasOwn(definition, "modelSchema") ||
      Object.hasOwn(definition, "getSchema") ||
      Object.hasOwn(definition, "getValue") ||
      Object.hasOwn(definition, "container") ||
      Object.hasOwn(definition, "fieldContainer"))
  )
    throw new FormworkError("INVALID_DEFINITION", "普通 render 与 schema 内容互斥");
  if (definition.render !== undefined && typeof definition.render !== "function")
    throw new FormworkError("INVALID_DEFINITION", "直接 JSX render 需要 formworkPlugin 转换");
  if (
    "getSchema" in definition &&
    definition.getSchema !== undefined &&
    typeof definition.getSchema !== "function"
  )
    throw new FormworkError("INVALID_DEFINITION", "getSchema 必须是函数");
  if (definition.render === undefined && typeof definition.container !== "function")
    throw new FormworkError("INVALID_DEFINITION", "模型内容必须声明 container");
}
/** 保存可寻址 Page，模型页默认使用 /router/:modelId。 */
export function definePage(definition: PageDefinition | PageAuthorDefinition): PageDefinition {
  assertBody(definition);
  return {
    ...definition,
    ...(!definition.render && definition.path === undefined
      ? { path: `/${definition.router}/:modelId` }
      : {}),
  } as PageDefinition;
}
/** 保存本地 Window 的相对路径、默认打开方式和值加载声明。 */
export function defineWindow(
  definition: WindowDefinition | WindowAuthorDefinition,
): WindowDefinition {
  assertBody(definition);
  if (
    definition.openMode !== undefined &&
    !["page", "modal", "drawer"].includes(definition.openMode)
  )
    throw new FormworkError("INVALID_DEFINITION", "Window openMode 无效");
  if (
    "getValue" in definition &&
    definition.getValue !== undefined &&
    typeof definition.getValue !== "function"
  )
    throw new FormworkError("INVALID_DEFINITION", "getValue 必须是函数");
  return { ...definition } as WindowDefinition;
}
/** 保存可被多个模型共享的领域覆盖，不创建 owner 或请求。 */
export function defineDomain(definition: DomainDefinition): DomainDefinition {
  return definition;
}
/** 装配应用；每次 render 在当前 Solid owner 下创建独立 Host。 */
export function defineFormwork(definition: FormworkDefinition): FormworkApplication {
  createRoutes(definition.pages);
  if (!definition.presenters.page)
    throw new FormworkError("MISSING_PRESENTER", "缺少 page Presenter");
  for (const page of definition.pages) {
    assertBody(page);
    if (!page.render) {
      if (!page.getSchema && !definition.getSchema)
        throw new FormworkError("INVALID_DEFINITION", `缺少 getSchema: ${page.router}`);
    }
    for (const window of Object.values(page.windows ?? {})) {
      assertBody(window);
      if (!page.render && !window.render && !page.container)
        throw new FormworkError("INVALID_DEFINITION", "模型 Window 必须属于模型 Page");
      if (page.render && !window.render)
        throw new FormworkError("INVALID_DEFINITION", "模型 Window 必须属于模型 Page");
      const mode = window.openMode ?? "page";
      if (!definition.presenters[mode])
        throw new FormworkError("MISSING_PRESENTER", `缺少 ${mode} Presenter`);
    }
  }
  return {
    render: () => (
      <Router root={() => <Host app={definition} />}>
        <Route path="*" component={() => null} />
      </Router>
    ),
  };
}
