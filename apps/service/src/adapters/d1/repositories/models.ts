import type { ModelDefinition } from "formwork/model";
import type { ModelHead, StorageManifest, StoredModel } from "../../../contracts";
import { ServiceError } from "../../../http/errors";

/** 读取当前模型头；不会使用 isolate 内缓存。 */
export function readHead(db: D1Database, id: string): Promise<ModelHead | null> {
  return db.prepare("SELECT * FROM fw_models WHERE id = ?").bind(id).first<ModelHead>();
}
/** 读取当前发布定义及实际存储状态。 */
export async function readPublished(db: D1Database, id: string): Promise<StoredModel> {
  const row = await db
    .prepare(
      `SELECT m.*, v.definition_json, v.storage_manifest_json, v.publish_revision
     FROM fw_models m JOIN fw_model_versions v
     ON v.model_id = m.id AND v.version = m.active_version WHERE m.id = ?`,
    )
    .bind(id)
    .first<
      ModelHead & {
        definition_json: string;
        storage_manifest_json: string;
        publish_revision: string;
      }
    >();
  if (!row) throw new ServiceError("NOT_FOUND", `模型 ${id} 尚未发布`, 404);
  return {
    head: row,
    version: row.active_version!,
    revision: row.publish_revision,
    definition: JSON.parse(row.definition_json) as ModelDefinition,
    manifest: JSON.parse(row.storage_manifest_json) as StorageManifest,
  };
}
/** 在 batch 开头加入断言，并在结尾删除临时 guard；失败会回滚整个事务。 */
export function transactionGuard(
  db: D1Database,
  condition: string,
  values: (string | number | null)[],
): { first: D1PreparedStatement; last: D1PreparedStatement } {
  const id = crypto.randomUUID();
  return {
    first: db
      .prepare(
        `INSERT INTO fw_commit_guards(id, ok) VALUES (?, CASE WHEN (${condition}) THEN 1 ELSE 0 END)`,
      )
      .bind(id, ...values),
    last: db.prepare("DELETE FROM fw_commit_guards WHERE id = ?").bind(id),
  };
}
/** 返回管理 revision 冲突；调用方必须保留自己的编辑内容。 */
export async function revisionConflict(db: D1Database, id: string): Promise<never> {
  const current = await readHead(db, id);
  throw new ServiceError(
    "REVISION_CONFLICT",
    "模型已被其他操作修改",
    409,
    [],
    current?.management_revision,
  );
}
