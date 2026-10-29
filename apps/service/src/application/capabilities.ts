import { z } from "zod";
import { validateRoutes, isObject, viewIssues } from "formwork/model";
import type { ModelDefinition } from "formwork/model";
import type { CapabilityManifest, EffectiveCapabilities } from "formwork/model";
import type { Env } from "../contracts";
import { tokenHash } from "./auth/password";
import { invalid, notFound, ServiceError } from "../http/errors";

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
    source: source.optional(),
  })
  .strict();
const capabilities = z
  .object({
    modelId: z.string(),
    router: z.string(),
    components: z.array(member),
    fn: z.array(member),
    schema: member.optional(),
    pageLoader: member.optional(),
    domainTransform: member.optional(),
    modelContract: z.string(),
    runtimeChecks: z.array(diagnostic),
  })
  .strict();
const manifestSchema = z
  .object({
    appId: z.literal("alien-form"),
    revision: z.string().regex(/^[a-f0-9]{64}$/u),
    clientOrigin: z.string().url(),
    routes: z.array(
      z
        .object({
          router: z.string(),
          path: z.string().optional(),
          presentation: z.enum(["page", "modal", "drawer"]).optional(),
          returnTo: z.string().optional(),
        })
        .strict(),
    ),
    schemaRouters: z.array(z.string()),
    defaultCapabilities: z.record(z.string(), capabilities),
    domainCapabilities: z.record(z.string(), z.record(z.string(), capabilities)),
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
  return JSON.parse(row.manifest_json) as CapabilityManifest;
}
/** 按 domain 覆盖选择路由能力；未知 domain 使用默认声明。 */
export function effectiveCapabilities(
  manifest: CapabilityManifest,
  id: string,
  router: string,
): EffectiveCapabilities {
  const value = manifest.domainCapabilities[id]?.[router] ?? manifest.defaultCapabilities[router];
  if (!value) notFound(`未知 router ${router}`);
  return { ...value, modelId: id };
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
  validateRoutes(manifest.routes);
  if (
    manifest.schemaRouters.some(
      (router) => !manifest.routes.some((route) => route.router === router),
    )
  )
    invalid("schemaRouters 必须属于 routes");
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
    const definition = JSON.parse(row.definition_json) as ModelDefinition;
    for (const [router, view] of Object.entries(definition.document.views ?? {})) {
      const capabilities = effectiveCapabilities(manifest, definition.document.id, router);
      const issues = viewIssues(
        view,
        definition.document.data,
        capabilities.components.map((item) => item.name),
      );
      if (issues.some((issue) => issue.code === "UNKNOWN_COMPONENT"))
        throw new ServiceError(
          "INVALID_MODEL",
          `清单删除了模型 ${definition.document.id} 已发布 View 使用的组件，请先迁移该模型`,
          422,
          issues,
        );
    }
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
