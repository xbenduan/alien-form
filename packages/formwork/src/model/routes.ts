import { FormworkError } from "./errors";
import { modelIdPattern } from "./schema";
import type { OpenMode, RouteTarget } from "./types";

/** 保存构建工具与浏览器共用的路由定义元信息。 */
export type RouteDefinition = RouteTarget & {
  path?: string;
  openMode?: OpenMode;
  model?: boolean;
};
/** 表示一个确定的路径匹配，不订阅后续全局参数变化。 */
export type RouteMatch = {
  definition: RouteDefinition;
  params: Readonly<Record<string, string>>;
  path: string;
};

function segments(path: string): string[] {
  if (
    !path.startsWith("/") ||
    (path.includes("?") && !path.endsWith("?")) ||
    path.includes("#") ||
    path.includes("//")
  )
    throw new FormworkError("INVALID_ROUTE", `无效路径 ${path}`);
  if (path === "/") return [];
  return path.slice(1).split("/");
}
function pattern(definition: RouteDefinition): string[] {
  const parts = segments(definition.path ?? `/${definition.router}`);
  for (const [i, part] of parts.entries()) {
    if (part.startsWith(":")) {
      if (
        !/^:[a-zA-Z][a-zA-Z0-9_]*\??$/u.test(part) ||
        (part.endsWith("?") && i !== parts.length - 1)
      )
        throw new FormworkError("INVALID_ROUTE", `无效参数段 ${part}`);
    } else if (!part || part === "." || part === ".." || /[:*?]/u.test(part))
      throw new FormworkError("INVALID_ROUTE", `无效固定路径段 ${part}`);
  }
  const names = parts
    .filter((part) => part.startsWith(":"))
    .map((part) => part.replace(/^:|\?$/gu, ""));
  if (new Set(names).size !== names.length)
    throw new FormworkError("INVALID_ROUTE", "路径参数重复");
  return parts;
}

/** 为 Page 与本地 Window 生成唯一的 View 和诊断索引。 */
export function routeKey(target: RouteTarget): string {
  return target.window === undefined ? target.router : `${target.router}/${target.window}`;
}

/** 从显式 Page 定义生成含本地 Window 归属的路由目录。 */
export function createRoutes(pages: readonly {
  router: string;
  path?: string;
  render?: unknown;
  windows?: Record<string, { path?: string; openMode?: OpenMode; render?: unknown }>;
}[]): RouteDefinition[] {
  const result: RouteDefinition[] = [];
  for (const page of pages) {
    const path = page.path ?? `/${page.router}${page.render === undefined ? "/:modelId" : ""}`;
    result.push({ router: page.router, path, model: page.render === undefined });
    for (const [window, definition] of Object.entries(page.windows ?? {})) {
      const relative = definition.path ?? window;
      if (!relative || relative.startsWith("/"))
        throw new FormworkError("INVALID_ROUTE", `Window path 必须是相对路径: ${window}`);
      result.push({
        router: page.router,
        window,
        path: `${path.replace(/\/$/u, "")}/${relative}`,
        openMode: definition.openMode ?? "page",
        model: page.render === undefined && definition.render === undefined,
      });
    }
  }
  validateRoutes(result);
  return result;
}

/** 校验 Page/Window 归属、固定段优先规则和同优先级路径歧义。 */
export function validateRoutes(definitions: readonly RouteDefinition[]): void {
  const byName = new Map<string, RouteDefinition>();
  for (const definition of definitions) {
    const key = routeKey(definition);
    if (!modelIdPattern.test(definition.router) ||
        (definition.window !== undefined && !modelIdPattern.test(definition.window)) ||
        byName.has(key))
      throw new FormworkError("INVALID_ROUTE", `无效或重复目标 ${key}`);
    byName.set(key, definition);
    pattern(definition);
  }
  const variants = (definition: RouteDefinition) => {
    const parts = pattern(definition);
    return parts.at(-1)?.endsWith("?") ? [parts, parts.slice(0, -1)] : [parts];
  };
  for (let i = 0; i < definitions.length; i++)
    for (let j = i + 1; j < definitions.length; j++) {
      for (const a of variants(definitions[i]!))
        for (const b of variants(definitions[j]!)) {
          if (
            a.length === b.length &&
            a.every(
              (part, index) =>
                part.startsWith(":") === b[index]!.startsWith(":") &&
                (part.startsWith(":") || part === b[index]),
            )
          )
            throw new FormworkError(
              "INVALID_ROUTE",
              `路径歧义 ${routeKey(definitions[i]!)} / ${routeKey(definitions[j]!)}`,
            );
        }
    }
  for (const definition of definitions)
    if (definition.window !== undefined) {
      const target = byName.get(definition.router);
      if (!target || target.window !== undefined)
        throw new FormworkError("INVALID_ROUTE", `Window 缺少所属 Page: ${routeKey(definition)}`);
      const names = new Set(
        pattern(definition)
          .filter((part) => part.startsWith(":"))
          .map((part) => part.replace(/^:|\?$/gu, "")),
      );
      for (const part of pattern(target))
        if (part.startsWith(":") && !part.endsWith("?") && !names.has(part.slice(1)))
          throw new FormworkError("INVALID_ROUTE", `Window 缺少所属 Page 参数 ${part}`);
    }
}

/** 填充并按段编码参数，未知 router 与缺少参数均明确失败。 */
export function routePath(
  definitions: readonly RouteDefinition[],
  target: string | RouteTarget,
  params: Readonly<Record<string, string | undefined>> = {},
): string {
  const reference = typeof target === "string" ? { router: target } : target;
  const definition = definitions.find((item) => routeKey(item) === routeKey(reference));
  if (!definition) throw new FormworkError("UNKNOWN_ROUTER", `未知目标 ${routeKey(reference)}`);
  const parts: string[] = [];
  for (const part of pattern(definition)) {
    if (!part.startsWith(":")) {
      parts.push(part);
      continue;
    }
    const name = part.replace(/^:|\?$/gu, "");
    const value = params[name];
    if (value === undefined || value === "") {
      if (!part.endsWith("?")) throw new FormworkError("PARAMS_REQUIRED", `缺少 ${name}`);
      continue;
    }
    if (name === "modelId" && !modelIdPattern.test(value))
      throw new FormworkError("INVALID_MODEL", `无效 modelId ${value}`);
    parts.push(encodeURIComponent(value));
  }
  return `/${parts.join("/")}`;
}

/** 只保留指定 Page 路径声明的参数，用于 Window 继承和返回。 */
export function pageParams(
  definition: RouteDefinition,
  params: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string | undefined>> {
  return Object.fromEntries(pattern(definition)
    .filter((part) => part.startsWith(":"))
    .map((part) => {
      const name = part.replace(/^:|\?$/gu, "");
      return [name, params[name]];
    }));
}

/** 匹配路径并返回独立参数；固定段按从左到右优先于动态段。 */
export function matchRoute(
  definitions: readonly RouteDefinition[],
  path: string,
): RouteMatch | undefined {
  const parts = path.split("?")[0]!.replace(/\/$/u, "").slice(1).split("/").filter(Boolean);
  const candidates: Array<{ match: RouteMatch; rank: number[] }> = [];
  for (const definition of definitions) {
    const rule = pattern(definition);
    if (
      parts.length !== rule.length &&
      !(rule.at(-1)?.endsWith("?") && parts.length === rule.length - 1)
    )
      continue;
    const params: Record<string, string> = {};
    let valid = true;
    const rank: number[] = [];
    for (let i = 0; i < rule.length; i++) {
      const part = rule[i]!;
      rank.push(part.startsWith(":") ? 0 : 1);
      if (!part.startsWith(":")) {
        if (part !== parts[i]) valid = false;
      } else if (parts[i] !== undefined) {
        let value: string;
        try {
          value = decodeURIComponent(parts[i]!);
        } catch {
          valid = false;
          break;
        }
        const name = part.replace(/^:|\?$/gu, "");
        if (name === "modelId" && !modelIdPattern.test(value)) {
          valid = false;
          break;
        }
        params[name] = value;
      }
    }
    if (valid)
      candidates.push({ match: { definition, params: Object.freeze(params), path }, rank });
  }
  candidates.sort((a, b) => {
    for (let i = 0; i < Math.max(a.rank.length, b.rank.length); i++) {
      const delta = (b.rank[i] ?? -1) - (a.rank[i] ?? -1);
      if (delta) return delta;
    }
    return 0;
  });
  return candidates[0]?.match;
}
