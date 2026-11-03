import { z } from "zod";
import {
  validateRoutes,
  isObject,
  fieldIssues,
  manifestRoutes,
  schemaTargets,
  manifestCapabilities,
  routeKey,
  FormworkError,
  selectDomain,
} from "formwork/model";
import type {
  ModelDocument,
  CapabilityManifest,
  EffectiveCapabilities,
  RouteTarget,
  ValidationReport,
} from "formwork/model";
import type { Env } from "../contracts";
import { tokenHash } from "./auth/password";
import { invalid, ServiceError } from "../http/errors";
import { storedDefinition } from "../adapters/d1/repositories/models";
import { modelContract } from "../../../../packages/domain-contracts";

const source = z
  .object({
    file: z.string(),
    line: z.number().int().positive(),
    column: z.number().int().positive(),
  })
  .strict();
const member = z
  .object({
    name: z.string(),
    source,
    declaration: z.string(),
    jsDoc: z.string().optional(),
    overrides: z.array(source).optional(),
  })
  .strict();
const diagnostic = z
  .object({
    path: z.string(),
    code: z.string(),
    message: z.string(),
    modelId: z.string().optional(),
    router: z.string().optional(),
    window: z.string().optional(),
    source: source.optional(),
  })
  .strict();
const layer = z
  .object({
    components: z.array(member),
    fn: z.array(member),
    formats: z.array(member).optional(),
    modelSchema: member.optional(),
    getSchema: member.optional(),
    transformSchema: member.optional(),
    getValue: member.optional(),
    runtimeChecks: z.array(diagnostic),
  })
  .strict();
const manifestSchema = z
  .object({
    formatVersion: z.literal(2),
    appId: z.literal("alien-form"),
    revision: z.string().regex(/^[a-f0-9]{64}$/u),
    clientOrigin: z.string().url(),
    presenters: z.array(z.enum(["page", "modal", "drawer"])),
    framework: layer,
    domains: z.record(z.string().regex(/^[a-z][a-z0-9_-]*$/u), layer),
    pages: z.record(
      z.string(),
      z
        .object({
          path: z.string(),
          model: z.boolean(),
          capabilities: layer,
          windows: z.record(
            z.string(),
            z
              .object({
                path: z.string(),
                model: z.boolean(),
                openMode: z.enum(["page", "modal", "drawer"]),
                capabilities: layer,
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();

/** 读取 DB 已激活的应用能力清单，未登记时明确失败。 */
export async function readManifest(db: D1Database): Promise<CapabilityManifest> {
  const row = await db
    .prepare(
      `SELECT m.manifest_json FROM fw_capability_manifests m JOIN fw_capability_heads h
     ON h.app_id = m.app_id AND h.revision = m.revision WHERE h.app_id = 'alien-form'`,
    )
    .first<{ manifest_json: string }>();
  if (!row) throw new ServiceError("CAPABILITIES_UNAVAILABLE", "应用代码能力清单尚未登记", 422);
  const parsed = manifestSchema.safeParse(JSON.parse(row.manifest_json));
  if (!parsed.success)
    throw new ServiceError(
      "CAPABILITIES_UNAVAILABLE",
      "应用代码能力清单版本已过期，请重新登记",
      422,
    );
  return parsed.data;
}
/** 根据当前模型文档与所属 Page/Window 解析四层代码能力。 */
export function effectiveCapabilities(
  manifest: CapabilityManifest,
  document: Pick<ModelDocument, "id" | "domain">,
  target: RouteTarget,
): EffectiveCapabilities {
  return manifestCapabilities(manifest, document, target);
}

/** 列出当前已激活应用的全部代码能力与路由参数，保留各层作用域。 */
export function capabilityCatalog(manifest: CapabilityManifest) {
  return {
    scope: "application" as const,
    appId: manifest.appId,
    revision: manifest.revision,
    clientOrigin: manifest.clientOrigin,
    mergeOrder: ["Framework", "selected Domain", "Page", "local Window"],
    domainSelection: "schema.domain；省略时匹配同名 modelId 的 Domain，否则只用 Framework。",
    framework: manifest.framework,
    domains: manifest.domains,
    pages: manifest.pages,
    presenters: manifest.presenters,
    targets: manifestRoutes(manifest).map((route) => {
      const path = route.path!;
      const requiredParams = path
        .split("/")
        .filter((part) => part.startsWith(":") && !part.endsWith("?"))
        .map((part) => part.slice(1));
      return {
        router: route.router,
        ...(route.window === undefined ? {} : { window: route.window }),
        viewKey: routeKey(route),
        path,
        model: route.model === true,
        ...(route.openMode === undefined ? {} : { openMode: route.openMode }),
        requiredParams,
        requiredPreviewParams: requiredParams.filter((name) => name !== "modelId"),
      };
    }),
    usage:
      "此目录是全部已登记能力，不代表每个目标都能使用所有组件。选定目标后调用 formwork.capabilities({modelId,router,window?,domain?}) 获取实际有效能力。",
  };
}

/** 校验字段组件引用，布局和打开方式仅由 Page/Window 代码决定。 */
export function capabilityReport(
  manifest: CapabilityManifest,
  document: ModelDocument,
  requested?: RouteTarget,
): ValidationReport {
  const errors: ValidationReport["errors"][number][] = [];
  const runtimeChecks: ValidationReport["runtimeChecks"][number][] = [];
  const targets = schemaTargets(manifest);
  const addError = (error: unknown, target?: RouteTarget) => {
    const issues =
      error instanceof FormworkError && error.issues.length
        ? error.issues
        : [
            {
              path: "/data",
              code: error instanceof FormworkError ? error.code : "INVALID_MODEL",
              message: error instanceof Error ? error.message : String(error),
            },
          ];
    errors.push(
      ...issues.map((issue) => ({
        ...issue,
        modelId: document.id,
        ...target,
      })),
    );
  };
  if (requested && !targets.some((target) => routeKey(target) === routeKey(requested))) {
    try {
      effectiveCapabilities(manifest, document, requested);
      errors.push({
        path: "/data",
        code: "INVALID_ROUTER",
        message: "此目标不加载 schema",
        ...requested,
      });
    } catch (error) {
      addError(error, requested);
    }
  }
  try {
    // Resolve once even if a manifest has no model pages, so unknown explicit Domains cannot escape.
    selectDomain(document, manifest.domains);
  } catch (error) {
    addError(error);
    return { errors, runtimeChecks };
  }
  for (const target of requested
    ? targets.filter((item) => routeKey(item) === routeKey(requested))
    : targets) {
    try {
      const capabilities = effectiveCapabilities(manifest, document, target);
      errors.push(
        ...fieldIssues(
          document,
          capabilities.components.map((item) => item.name),
          modelContract(document),
        ).map((issue) => ({ ...issue, modelId: document.id, ...target })),
      );
      runtimeChecks.push(...capabilities.runtimeChecks);
    } catch (error) {
      addError(error, target);
    }
  }
  return { errors, runtimeChecks };
}
/** 检查来源和内容摘要并幂等登记能力清单，同时激活当前 revision。 */
export async function registerCapabilities(env: Env, appId: string, input: unknown) {
  const body = z
    .object({ revision: z.string(), manifest: manifestSchema, origin: z.string() })
    .strict()
    .parse(input);
  if (
    appId !== "alien-form" ||
    body.manifest.appId !== appId ||
    body.revision !== body.manifest.revision
  )
    invalid("appId 与清单 revision 必须匹配");
  const origin = new URL(body.origin);
  if (
    origin.origin !== body.origin ||
    body.origin !== body.manifest.clientOrigin ||
    !env.FORMWORK_CLIENT_ORIGIN.split(",")
      .map((value) => value.trim())
      .includes(body.origin)
  )
    invalid("能力清单 origin 必须是配置的客户端 origin");
  // Keep the original JSON key order: the Vite plugin hashes the serialized content.
  const manifest = isObject(input) ? (input.manifest as CapabilityManifest) : body.manifest;
  const routes = manifestRoutes(manifest);
  validateRoutes(routes);
  if (!manifest.presenters.includes("page")) invalid("必须注册 page Presenter");
  for (const route of routes)
    if (route.window && !manifest.presenters.includes(route.openMode ?? "page"))
      invalid(`缺少 ${route.openMode} Presenter`);
  const { revision: _revision, ...contents } = manifest;
  if ((await tokenHash(JSON.stringify(contents))) !== manifest.revision)
    invalid("能力清单内容摘要不匹配");
  // An existing revision must never silently bind to different serialized content.
  const previous = await env.DB.prepare(
    "SELECT manifest_json FROM fw_capability_manifests WHERE app_id = ? AND revision = ?",
  )
    .bind(appId, manifest.revision)
    .first<{ manifest_json: string }>();
  if (previous && previous.manifest_json !== JSON.stringify(manifest))
    invalid("同一清单 revision 内容不一致");
  const published = (
    await env.DB.prepare(
      `SELECT v.definition_json FROM fw_models m JOIN fw_model_versions v
     ON m.id = v.model_id AND m.active_version = v.version`,
    ).all<{ definition_json: string }>()
  ).results;
  for (const row of published) {
    const definition = storedDefinition(row.definition_json);
    const report = capabilityReport(manifest, definition.schema);
    if (report.errors.length)
      throw new ServiceError(
        "INVALID_MODEL",
        `清单变更使已发布模型 ${definition.schema.id} 的字段组件失效，请先迁移该模型`,
        422,
        report.errors,
      );
  }
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO fw_capability_manifests(app_id, revision, manifest_json, client_origin, registered_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(
      appId,
      manifest.revision,
      JSON.stringify(manifest),
      manifest.clientOrigin,
      new Date().toISOString(),
    ),
    env.DB.prepare(
      "INSERT INTO fw_capability_heads(app_id, revision) VALUES (?, ?) ON CONFLICT(app_id) DO UPDATE SET revision = excluded.revision",
    ).bind(appId, manifest.revision),
  ]);
  return { appId, revision: manifest.revision, registered: true };
}
