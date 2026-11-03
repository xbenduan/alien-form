import { z } from "zod";
import {
  isObject,
  fieldIssues,
  manifestRoutes,
  schemaTargets,
  manifestCapabilities,
} from "formwork/model";
import type {
  ModelDocument,
  CapabilityManifest,
  RouteTarget,
  ValidationReport,
} from "formwork/model";
import type { Env } from "../contracts";
import { tokenHash } from "./auth/password";
import { invalid, ServiceError } from "../http/errors";
import { storedDefinition, transactionGuard } from "../adapters/d1/repositories/models";
import { cmsContract } from "../../../../packages/domain-contracts";

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
const domain = z
  .object({
    transformSchema: member.optional(),
    runtimeChecks: z.array(diagnostic),
  })
  .strict();
const router = z.string().regex(/^[a-z][a-z0-9-]*$/u);
const manifestSchema = z
  .object({
    formatVersion: z.literal(1),
    appId: z.literal("alien-form"),
    revision: z.string().regex(/^[a-f0-9]{64}$/u),
    clientOrigin: z.string().url(),
    app: z
      .object({
        components: z.array(member),
        formats: z.array(member),
        ui: member,
        inferFormat: member.optional(),
        transformSchema: member.optional(),
        runtimeChecks: z.array(diagnostic),
      })
      .strict(),
    domains: z.record(router, domain),
    pages: z.array(router),
  })
  .strict();

/** 读取可选静态清单；未登记应用仍可校验和发布模型。 */
export async function findManifest(db: D1Database): Promise<CapabilityManifest | undefined> {
  const row = await db
    .prepare(
      `SELECT m.manifest_json FROM fw_capability_manifests m JOIN fw_capability_heads h
     ON h.app_id = m.app_id AND h.revision = m.revision WHERE h.app_id = 'alien-form'`,
    )
    .first<{ manifest_json: string }>();
  if (!row) return undefined;
  return manifestSchema.parse(JSON.parse(row.manifest_json));
}

/** 为代码能力发现及可分享预览读取已登记清单。 */
export async function readManifest(db: D1Database): Promise<CapabilityManifest> {
  const manifest = await findManifest(db);
  if (!manifest)
    throw new ServiceError("CAPABILITIES_UNAVAILABLE", "应用代码能力清单尚未登记", 422);
  return manifest;
}

/** 按 router 返回 app 共享能力及 Domain 加工声明。 */
export const effectiveCapabilities = manifestCapabilities;

/** 列出可用代码声明和明确的 Domain/Page 路由。 */
export function capabilityCatalog(manifest: CapabilityManifest) {
  return {
    scope: "application" as const,
    appId: manifest.appId,
    revision: manifest.revision,
    clientOrigin: manifest.clientOrigin,
    transformOrder: ["app", "Domain", "local"],
    domainSelection: "URL router 选择 Domain；schema.domain 仅为业务分类。",
    app: manifest.app,
    domains: manifest.domains,
    pages: manifest.pages,
    targets: manifestRoutes(manifest),
    usage:
      "调用 formwork.capabilities({modelId,router}) 查看目标能力。app.ui 动态映射和局部加工需要浏览器验证。",
  };
}

/** 只校验显式字段组件引用；动态 UI 映射通过真实挂载验证。 */
export function capabilityReport(
  manifest: CapabilityManifest,
  document: ModelDocument,
  requested?: RouteTarget,
): ValidationReport {
  const errors: ValidationReport["errors"][number][] = [];
  const runtimeChecks: ValidationReport["runtimeChecks"][number][] = [];
  if (requested && !Object.hasOwn(manifest.domains, requested.router))
    return {
      errors: [
        {
          path: "/data",
          code: "UNKNOWN_ROUTER",
          message: "目标必须是已登记的 Domain",
          modelId: document.id,
          router: requested.router,
        },
      ],
      runtimeChecks,
    };
  // 应用没有 Domain 时，Page 仍可能通过 useModel 消费这些字段。
  errors.push(
    ...fieldIssues(
      document,
      manifest.app.components.map((item) => item.name),
      cmsContract,
    ).map((issue) => ({ ...issue, modelId: document.id, ...requested })),
  );
  for (const target of requested ? [requested] : schemaTargets(manifest))
    runtimeChecks.push(...effectiveCapabilities(manifest, document, target).runtimeChecks);
  return { errors, runtimeChecks };
}

/** 校验来源和摘要，并在已发布模型未变化的同一事务中激活清单。 */
export async function registerCapabilities(env: Env, appId: string, input: unknown) {
  const body = z
    .object({
      revision: z.string(),
      manifest: manifestSchema,
      origin: z.string(),
    })
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
  // 摘要保留原始 JSON 键顺序，与构建工具保持一致。
  const manifest = isObject(input) ? (input.manifest as CapabilityManifest) : body.manifest;
  manifestRoutes(manifest);
  const { revision: _revision, ...contents } = manifest;
  if ((await tokenHash(JSON.stringify(contents))) !== manifest.revision)
    invalid("能力清单内容摘要不匹配");
  const previous = await env.DB.prepare(
    "SELECT manifest_json FROM fw_capability_manifests WHERE app_id = ? AND revision = ?",
  )
    .bind(appId, manifest.revision)
    .first<{ manifest_json: string }>();
  if (previous && previous.manifest_json !== JSON.stringify(manifest))
    invalid("同一清单 revision 内容不一致");
  const published = (
    await env.DB.prepare(
      `SELECT m.id, m.active_version AS version, v.definition_json FROM fw_models m JOIN fw_model_versions v
     ON m.id = v.model_id AND m.active_version = v.version`,
    ).all<{ id: string; version: number; definition_json: string }>()
  ).results;
  for (const row of published) {
    const definition = storedDefinition(row.definition_json);
    const report = capabilityReport(manifest, definition.schema);
    if (report.errors.length)
      throw new ServiceError(
        "INVALID_MODEL",
        `清单变更使已发布模型 ${definition.schema.id} 的字段组件失效，请先修改该模型`,
        422,
        report.errors,
      );
  }
  const guard = transactionGuard(
    env.DB,
    `(SELECT COUNT(*) FROM fw_models WHERE active_version IS NOT NULL) = ?
     AND NOT EXISTS(SELECT 1 FROM json_each(?) s LEFT JOIN fw_models m ON m.id = json_extract(s.value, '$.id')
       WHERE m.active_version IS NOT json_extract(s.value, '$.version'))`,
    [published.length, JSON.stringify(published.map(({ id, version }) => ({ id, version })))],
  );
  try {
    await env.DB.batch([
      guard.first,
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
      guard.last,
    ]);
  } catch (error) {
    if (error instanceof Error && error.message.includes("CHECK constraint failed"))
      throw new ServiceError("REVISION_CONFLICT", "模型发布状态已改变，请重新登记清单", 409);
    throw error;
  }
  return { appId, revision: manifest.revision, registered: true };
}
