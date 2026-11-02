import { FormworkError } from "./errors";
import { escapePointer } from "./pointer";
import { modelIdPattern } from "./schema";
import { routeKey } from "./routes";
import type { RouteDefinition } from "./routes";
import type {
  CapabilityLayer,
  CapabilityManifest,
  CapabilityMember,
  EffectiveCapabilities,
  ModelDocument,
  OpenMode,
  RouteTarget,
  ValidationIssue,
} from "./types";

/** 根据文档选择唯一 Domain，显式未知名称报错，隐式缺省使用框架能力。 */
export function selectDomain(
  document: Pick<ModelDocument, "id" | "domain">,
  registered: Readonly<Record<string, unknown>>,
): string | undefined {
  if (document.domain !== undefined) {
    if (!modelIdPattern.test(document.domain) || !Object.hasOwn(registered, document.domain))
      throw new FormworkError("UNKNOWN_DOMAIN", `Domain 未注册: ${document.domain}`, [
        { path: "/domain", code: "UNKNOWN_DOMAIN", message: `Domain 未注册: ${document.domain}` },
      ]);
    return document.domain;
  }
  return Object.hasOwn(registered, document.id) ? document.id : undefined;
}

/** 合并具名能力，后层只覆盖同名项，不继承注册表的原型成员。 */
export function mergeRegistry<T>(...layers: readonly (Readonly<Record<string, T>> | undefined)[]): Record<string, T> {
  return Object.fromEntries(layers.flatMap((layer) => Object.entries(layer ?? {})));
}

/** 按当前操作的 schema 配置与 Window 默认值选择打开方式。 */
export function selectOpenMode(
  document: Pick<ModelDocument, "pages"> | undefined,
  target: RouteTarget,
  fallback: OpenMode = "page",
): OpenMode {
  const configured = target.window === undefined ? undefined :
    document?.pages?.[target.router]?.windows?.[target.window]?.openMode;
  const mode = configured ?? fallback;
  if (!["page", "drawer", "modal"].includes(mode))
    throw new FormworkError("INVALID_OPEN_MODE", `无效 openMode: ${mode}`);
  return mode;
}

/** 检查文档引用的 Page、本地 Window 与实际可用 Presenter。 */
export function presentationIssues(
  document: Pick<ModelDocument, "pages">,
  routes: readonly RouteDefinition[],
  presenters: readonly OpenMode[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [router, page] of Object.entries(document.pages ?? {})) {
    const root = `/pages/${escapePointer(router)}`;
    if (!routes.some((item) => item.router === router && item.window === undefined && item.model)) {
      issues.push({ path: root, code: "UNKNOWN_ROUTER", message: `未知模型 Page: ${router}` });
      continue;
    }
    for (const [window, config] of Object.entries(page.windows ?? {})) {
      const path = `${root}/windows/${escapePointer(window)}`;
      const definition = routes.find((item) => item.router === router && item.window === window);
      if (!definition) {
        issues.push({ path, code: "UNKNOWN_WINDOW", message: `未知 Window: ${router}/${window}` });
        continue;
      }
      const mode = config.openMode ?? definition.openMode ?? "page";
      if (!presenters.includes(mode))
        issues.push({ path: `${path}/openMode`, code: "MISSING_PRESENTER", message: `缺少 ${mode} Presenter` });
    }
  }
  return issues;
}

/** 从能力清单恢复运行时相同的路由目录，不携带源码函数。 */
export function manifestRoutes(manifest: CapabilityManifest): RouteDefinition[] {
  return Object.entries(manifest.pages).flatMap(([router, page]) => [
    { router, path: page.path, model: page.model },
    ...Object.entries(page.windows).map(([window, definition]) => ({
      router, window, path: definition.path, openMode: definition.openMode, model: definition.model,
    })),
  ]);
}

/** 列出清单中需要模型字段能力校验的 Page 和本地 Window。 */
export function schemaTargets(manifest: CapabilityManifest): RouteTarget[] {
  return manifestRoutes(manifest).filter((item) => item.model)
    .map(({ router, window }) => ({ router, ...(window === undefined ? {} : { window }) }));
}

function namedMembers(layers: readonly CapabilityLayer[], name: "components" | "fn"): CapabilityMember[] {
  const result = new Map<string, CapabilityMember>();
  for (const layer of layers) for (const member of layer[name]) {
    const previous = result.get(member.name);
    result.set(member.name, {
      ...member,
      ...(previous ? { overrides: [...(previous.overrides ?? []), previous.source] } : {}),
    });
  }
  return [...result.values()];
}

/** 按文档与 Page/Window 目标解析静态能力，覆盖顺序与浏览器保持一致。 */
export function manifestCapabilities(
  manifest: CapabilityManifest,
  document: Pick<ModelDocument, "id" | "domain">,
  target: RouteTarget,
): EffectiveCapabilities {
  const page = Object.hasOwn(manifest.pages, target.router) ? manifest.pages[target.router] : undefined;
  if (!page) throw new FormworkError("UNKNOWN_ROUTER", `未知 Page: ${target.router}`);
  const window = target.window !== undefined && Object.hasOwn(page.windows, target.window)
    ? page.windows[target.window] : undefined;
  if (target.window !== undefined && !window)
    throw new FormworkError("UNKNOWN_WINDOW", `未知 Window: ${routeKey(target)}`);
  const domain = selectDomain(document, manifest.domains);
  const selected = domain === undefined ? undefined : manifest.domains[domain];
  const layers = [manifest.framework, ...(selected ? [selected] : []),
    page.capabilities, ...(window ? [window.capabilities] : [])];
  return {
    modelId: document.id,
    ...target,
    ...(domain === undefined ? {} : { domain }),
    components: namedMembers(layers, "components"),
    fn: namedMembers(layers, "fn"),
    modelSchema: selected?.modelSchema ?? manifest.framework.modelSchema,
    pageLoader: page.capabilities.getSchema ?? manifest.framework.getSchema,
    domainTransform: selected?.transformSchema,
    valueLoader: window?.capabilities.getValue,
    modelContract: "ModelDefinition.document: { id, domain?, title, data, fields?, tree?, views?, pages? }; Domain selects reusable code; modelId selects stored data; pages[router].windows[name].openMode selects page/drawer/modal; views use router or router/window; backend owns storage, relations, permissions and trusted behavior.",
    runtimeChecks: layers.flatMap((layer) => layer.runtimeChecks).map((check) => ({
      ...check, modelId: document.id, ...target,
    })),
  };
}
