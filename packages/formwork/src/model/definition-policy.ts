import { FormworkError } from "./errors";
import { createRoutes } from "./routes";
import type { RouteDefinition } from "./routes";
import type {
  CapabilityManifest,
  EffectiveCapabilities,
  ModelDocument,
  RouteTarget,
} from "./types";

/** 从清单恢复与浏览器一致的固定路由目录。 */
export function manifestRoutes(manifest: CapabilityManifest): RouteDefinition[] {
  return createRoutes(
    Object.keys(manifest.domains).map((router) => ({ router })),
    manifest.pages.map((router) => ({ router })),
  );
}

/** 列出会加载模型的 Domain，普通 Page 自行管理数据。 */
export function schemaTargets(manifest: CapabilityManifest): RouteTarget[] {
  return Object.keys(manifest.domains).map((router) => ({ router }));
}

/** 根据 router 选择 Domain 加工，所有目标共用 app 组件及字段契约。 */
export function manifestCapabilities(
  manifest: CapabilityManifest,
  document: Pick<ModelDocument, "id" | "domain">,
  target: RouteTarget,
): EffectiveCapabilities {
  const domain = Object.hasOwn(manifest.domains, target.router)
    ? manifest.domains[target.router]
    : undefined;
  if (!domain)
    throw new FormworkError("UNKNOWN_ROUTER", `目标必须是已登记的 Domain：${target.router}`);
  return {
    modelId: document.id,
    router: target.router,
    ...(document.domain === undefined ? {} : { domain: document.domain }),
    components: manifest.app.components,
    formats: manifest.app.formats,
    ui: manifest.app.ui,
    inferFormat: manifest.app.inferFormat,
    appTransform: manifest.app.transformSchema,
    domainTransform: domain?.transformSchema,
    modelContract:
      "ModelDefinition: {schemaVersion:1,id,domain?,title,data:fieldMap,$defs?,tree?,backend?}. app owns components and ui. Domain router selects layout; schema.domain is business metadata. transformSchema runs app → Domain → local. Records/Detail/Editor are lazy atoms.",
    runtimeChecks: [...manifest.app.runtimeChecks, ...(domain?.runtimeChecks ?? [])].map(
      (check) => ({ ...check, modelId: document.id, router: target.router }),
    ),
  };
}
