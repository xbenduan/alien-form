import { FormworkError } from "./errors";
import { modelIdPattern } from "./schema";
import type { RouteTarget } from "./types";

/** 描述 Domain 的模型路径或 Page 的固定路径。 */
export type RouteDefinition = RouteTarget & { path: string; model: boolean };

/** 从显式 Domain 和 Page 注册生成唯一目录。 */
export function createRoutes(
  domains: readonly RouteTarget[],
  pages: readonly RouteTarget[],
): RouteDefinition[] {
  const routes = [
    ...domains.map(({ router }) => ({ router, path: `/${router}/:modelId`, model: true })),
    ...pages.map(({ router }) => ({ router, path: `/${router}`, model: false })),
  ];
  validateRoutes(routes);
  return routes;
}

/** 校验 router 唯一性及固定路径规则，与浏览器的注册约束保持一致。 */
export function validateRoutes(routes: readonly RouteDefinition[]): void {
  const names = new Set<string>();
  for (const route of routes) {
    if (!/^[a-z][a-z0-9-]*$/u.test(route.router) || names.has(route.router))
      throw new FormworkError("INVALID_ROUTE", `无效或重复 router ${route.router}`);
    if (route.path !== `/${route.router}${route.model ? "/:modelId" : ""}`)
      throw new FormworkError("INVALID_ROUTE", `无效路径 ${route.path}`);
    names.add(route.router);
  }
}

/** 生成已注册路径；模型 Domain 必须提供合法 modelId。 */
export function routePath(
  routes: readonly RouteDefinition[],
  target: string | RouteTarget,
  modelId?: string,
): string {
  const router = typeof target === "string" ? target : target.router;
  const route = routes.find((item) => item.router === router);
  if (!route) throw new FormworkError("UNKNOWN_ROUTER", `未知 router ${router}`);
  if (!route.model) return route.path;
  if (!modelId || !modelIdPattern.test(modelId))
    throw new FormworkError("INVALID_MODEL", "Domain 路径需要合法 modelId");
  return `/${router}/${encodeURIComponent(modelId)}`;
}
