import { assertDraftDefinition, modelIdPattern, routePath } from "formwork/model";
import type {
  DraftDefinition,
  ManagedEntry,
  ManagedSnapshot,
  PublishedSnapshot,
  PreviewSnapshot,
} from "formwork/model";
import type { Actor, ModelHead, StoredModel } from "../contracts";
import {
  readHead,
  readPublished,
  revisionConflict,
  transactionGuard,
} from "../adapters/d1/repositories/models";
import { planStorage } from "../adapters/d1/compiler/storage";
import { accessFor, projectSchema } from "./auth/access";
import { requireUser } from "./auth/service";
import { effectiveCapabilities, readManifest } from "./capabilities";
import { validateDefinition } from "./model-validation";
import { forbidden, invalid, notFound, ServiceError } from "../http/errors";

/** 检查所有 HTTP 和 MCP 使用的模型身份。 */
export function assertModelId(id: string): void {
  if (!modelIdPattern.test(id)) invalid("modelId 必须是单段小写标识");
}
/** 用最新共享草稿、不可变版本及当前权限提供模型管理服务。 */
export class ModelService {
  constructor(
    private readonly db: D1Database,
    private readonly actor: Actor,
  ) {}

  private async manageable(
    id: string,
    action: "manage" | "publish" = "manage",
  ): Promise<{ head: ModelHead; published?: StoredModel }> {
    assertModelId(id);
    const head = await readHead(this.db, id);
    if (!head) notFound(`模型 ${id} 不存在`);
    const published = head.active_version ? await readPublished(this.db, id) : undefined;
    if (
      !(
        this.actor.super ||
        head.creator_id === this.actor.id ||
        (published && accessFor(published, this.actor, action).allowed)
      )
    )
      forbidden();
    return { head, published };
  }
  async list(): Promise<ManagedEntry[]> {
    const heads = (
      await this.db.prepare("SELECT * FROM fw_models ORDER BY updated_at DESC, id").all<ModelHead>()
    ).results;
    const entries: ManagedEntry[] = [];
    for (const head of heads) {
      try {
        const snapshot = await this.read(head.id);
        const {
          definition: _definition,
          diagnostics: _diagnostics,
          baseVersion: _base,
          ...entry
        } = snapshot;
        entries.push(entry);
      } catch (error) {
        if (!(error instanceof ServiceError && error.status === 403)) throw error;
      }
    }
    return entries;
  }
  async read(id: string): Promise<ManagedSnapshot> {
    assertModelId(id);
    const row = await this.db
      .prepare(
        `SELECT m.*, d.definition_json AS draft_json, d.base_version, d.diagnostics_json,
        v.definition_json AS published_json, v.storage_manifest_json, v.publish_revision
       FROM fw_models m LEFT JOIN fw_model_drafts d ON d.model_id = m.id
       LEFT JOIN fw_model_versions v ON v.model_id = m.id AND v.version = m.active_version
       WHERE m.id = ?`,
      )
      .bind(id)
      .first<
        ModelHead & {
          draft_json: string | null;
          base_version: number | null;
          diagnostics_json: string | null;
          published_json: string | null;
          storage_manifest_json: string | null;
          publish_revision: string | null;
        }
      >();
    if (!row) notFound(`模型 ${id} 不存在`);
    const head = row;
    const published: StoredModel | undefined = row.published_json
      ? {
          head,
          definition: JSON.parse(row.published_json),
          manifest: JSON.parse(row.storage_manifest_json!),
          version: head.active_version!,
          revision: row.publish_revision!,
        }
      : undefined;
    if (
      !(
        this.actor.super ||
        head.creator_id === this.actor.id ||
        (published && accessFor(published, this.actor, "manage").allowed)
      )
    )
      forbidden();
    const definition = JSON.parse(row.draft_json ?? row.published_json!) as DraftDefinition;
    return {
      id,
      title: typeof definition.document.title === "string" ? definition.document.title : id,
      revision: head.management_revision,
      stage: row.draft_json ? "draft" : "published",
      publishedVersion: head.active_version,
      definition,
      baseVersion: row.draft_json ? row.base_version : head.active_version,
      diagnostics: row.draft_json
        ? JSON.parse(row.diagnostics_json!)
        : { errors: [], runtimeChecks: [] },
      canManage: true,
      canPublish:
        this.actor.kind === "user" &&
        (this.actor.super ||
          head.creator_id === this.actor.id ||
          (!!published && accessFor(published, this.actor, "publish").allowed)),
    };
  }
  async validate(id: string, input: unknown, router?: string) {
    assertModelId(id);
    const head = await readHead(this.db, id);
    const previous = head ? (await this.manageable(id)).published : undefined;
    if (!head && (!this.actor.canCreateModel || id.startsWith("system-"))) forbidden();
    return (await validateDefinition(this.db, assertDraftDefinition(input, id), previous, router))
      .report;
  }
  async save(id: string, input: unknown, ifRevision: string | null): Promise<ManagedSnapshot> {
    assertModelId(id);
    const definition = assertDraftDefinition(input, id);
    const head = await readHead(this.db, id);
    if (ifRevision === null) {
      if (head) return revisionConflict(this.db, id);
      if (!this.actor.canCreateModel || id.startsWith("system-")) forbidden();
    } else {
      if (!head) return revisionConflict(this.db, id);
      await this.manageable(id);
      if (head.management_revision !== ifRevision) return revisionConflict(this.db, id);
    }
    const previous = head?.active_version ? await readPublished(this.db, id) : undefined;
    const validation = await validateDefinition(this.db, definition, previous);
    const now = new Date().toISOString(),
      next = crypto.randomUUID();
    const guard = transactionGuard(
      this.db,
      ifRevision === null
        ? "NOT EXISTS(SELECT 1 FROM fw_models WHERE id = ?)"
        : "EXISTS(SELECT 1 FROM fw_models WHERE id = ? AND management_revision = ?)",
      ifRevision === null ? [id] : [id, ifRevision],
    );
    try {
      await this.db.batch([
        guard.first,
        ...(head
          ? [
              this.db
                .prepare(
                  "UPDATE fw_models SET management_revision = ?, updated_at = ? WHERE id = ?",
                )
                .bind(next, now, id),
            ]
          : [
              this.db
                .prepare(
                  "INSERT INTO fw_models(id, creator_id, management_revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                )
                .bind(id, this.actor.id, next, now, now),
            ]),
        this.db
          .prepare(`INSERT INTO fw_model_drafts(model_id, base_version, definition_json, diagnostics_json,
          validated_manifest_revision, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(model_id) DO UPDATE SET definition_json = excluded.definition_json,
          diagnostics_json = excluded.diagnostics_json, validated_manifest_revision = excluded.validated_manifest_revision,
          updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
          .bind(
            id,
            head?.active_version ?? null,
            JSON.stringify(definition),
            JSON.stringify(validation.report),
            validation.manifest?.revision ?? null,
            this.actor.id,
            now,
          ),
        guard.last,
      ]);
    } catch (error) {
      const current = await readHead(this.db, id);
      if (ifRevision === null ? !!current : current?.management_revision !== ifRevision)
        return revisionConflict(this.db, id);
      throw error;
    }
    return this.read(id);
  }
  async publish(id: string, ifRevision: string): Promise<PublishedSnapshot> {
    requireUser(this.actor);
    const { head, published } = await this.manageable(id, "publish");
    if (head.management_revision !== ifRevision) return revisionConflict(this.db, id);
    const draft = await this.db
      .prepare("SELECT definition_json FROM fw_model_drafts WHERE model_id = ?")
      .bind(id)
      .first<{ definition_json: string }>();
    if (!draft) invalid("没有可发布的已保存草稿");
    const result = await validateDefinition(this.db, JSON.parse(draft.definition_json), published);
    if (result.report.errors.length || !result.definition || !result.manifest)
      throw new ServiceError("INVALID_MODEL", "草稿未通过发布校验", 422, result.report.errors);
    const plan = await planStorage(this.db, result.definition, published?.manifest);
    const version = (head.active_version ?? 0) + 1;
    const revision = crypto.randomUUID(),
      nextManagement = crypto.randomUUID();
    const guard = transactionGuard(
      this.db,
      `EXISTS(SELECT 1 FROM fw_models WHERE id = ? AND management_revision = ? AND active_version IS ?)
       AND EXISTS(SELECT 1 FROM fw_capability_heads WHERE app_id = 'alien-form' AND revision = ?)`,
      [id, ifRevision, head.active_version, result.manifest.revision],
    );
    try {
      await this.db.batch([
        guard.first,
        ...plan.statements,
        this.db
          .prepare(`INSERT INTO fw_model_versions(model_id, version, definition_json, storage_manifest_json,
          publish_revision, manifest_revision, published_by, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            id,
            version,
            JSON.stringify(result.definition),
            JSON.stringify(plan.manifest),
            revision,
            result.manifest.revision,
            this.actor.id,
            new Date().toISOString(),
          ),
        this.db
          .prepare(
            "UPDATE fw_models SET active_version = ?, storage_table = ?, management_revision = ?, updated_at = ? WHERE id = ?",
          )
          .bind(version, plan.manifest.table, nextManagement, new Date().toISOString(), id),
        this.db.prepare("DELETE FROM fw_model_drafts WHERE model_id = ?").bind(id),
        guard.last,
      ]);
    } catch (error) {
      const current = await readHead(this.db, id);
      if (
        current?.management_revision !== ifRevision ||
        current?.active_version !== head.active_version
      )
        return revisionConflict(this.db, id);
      const manifest = await readManifest(this.db);
      if (manifest.revision !== result.manifest.revision)
        throw new ServiceError(
          "REVISION_CONFLICT",
          "应用代码能力清单已改变，请重新校验草稿",
          409,
          [],
          ifRevision,
        );
      throw new ServiceError("STORAGE_INCOMPATIBLE", "数据库变更失败，原版本和草稿已保留", 422, [
        {
          path: "/backend/storage",
          code: "DDL_FAILED",
          message: error instanceof Error ? error.message : String(error),
        },
      ]);
    }
    return { id, version, revision, definition: result.definition };
  }
  async versions(id: string): Promise<PublishedSnapshot[]> {
    requireUser(this.actor);
    await this.manageable(id);
    const rows = (
      await this.db
        .prepare(
          "SELECT version, publish_revision, definition_json FROM fw_model_versions WHERE model_id = ? ORDER BY version DESC",
        )
        .bind(id)
        .all<{ version: number; publish_revision: string; definition_json: string }>()
    ).results;
    return rows.map((row) => ({
      id,
      version: row.version,
      revision: row.publish_revision,
      definition: JSON.parse(row.definition_json),
    }));
  }
  async preview(id: string, router: string, params: Record<string, string>, expected?: string) {
    const snapshot = await this.read(id);
    if (expected && snapshot.revision !== expected) return revisionConflict(this.db, id);
    const manifest = await readManifest(this.db);
    effectiveCapabilities(manifest, id, router);
    if (!manifest.schemaRouters.includes(router)) invalid("此 router 不加载 schema");
    routePath(manifest.routes, router, { ...params, domain: id });
    const url = new URL(`/model-preview/${encodeURIComponent(id)}`, manifest.clientOrigin);
    url.searchParams.set("router", router);
    url.searchParams.set("revision", snapshot.revision);
    for (const [key, value] of Object.entries(params))
      if (!["router", "revision", "domain"].includes(key)) url.searchParams.set(key, value);
    return { modelId: id, router, revision: snapshot.revision, url: url.href };
  }
  async draftSchema(id: string, revision: string): Promise<PreviewSnapshot> {
    requireUser(this.actor);
    const snapshot = await this.read(id);
    if (snapshot.revision !== revision) return revisionConflict(this.db, id);
    const head = await readHead(this.db, id);
    const result = await validateDefinition(
      this.db,
      snapshot.definition,
      head?.active_version ? await readPublished(this.db, id) : undefined,
    );
    if (!result.definition || result.report.errors.length)
      throw new ServiceError("INVALID_MODEL", "草稿无法预览", 422, result.report.errors);
    return {
      schema: result.definition.document,
      managementRevision: revision,
      stage: snapshot.stage,
      baseVersion: snapshot.baseVersion,
    };
  }
  async runtime(id: string) {
    assertModelId(id);
    const model = await readPublished(this.db, id);
    return {
      schema: projectSchema(model, this.actor),
      version: model.version,
      revision: model.revision,
    };
  }
  async capabilities(id: string, router: string) {
    assertModelId(id);
    const head = await readHead(this.db, id);
    if (head) {
      try {
        await this.manageable(id);
      } catch (error) {
        if (!head.active_version) throw error;
        projectSchema(await readPublished(this.db, id), this.actor);
      }
    } else if (!this.actor.canCreateModel) forbidden();
    return effectiveCapabilities(await readManifest(this.db), id, router);
  }
}
