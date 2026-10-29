import type {
  ActorSummary,
  ModelDefinition,
  StorageBinding,
  RelationDefinition,
} from "formwork/model";

/** 保存从 credential 和当前系统记录解析的可信请求身份。 */
export type Actor = ActorSummary & {
  credentialId: string;
  roleIds: ReadonlySet<string>;
};
/** 保存可执行 Worker 配置，不将 secret 传入浏览器。 */
export interface Env {
  DB: D1Database;
  FORMWORK_CLIENT_ORIGIN: string;
  FORMWORK_BOOTSTRAP_ADMIN_USERNAME?: string;
  FORMWORK_BOOTSTRAP_ADMIN_PASSWORD?: string;
  FORMWORK_CAPABILITY_TOKEN?: string;
}
/** 描述持久化的模型头状态。 */
export type ModelHead = {
  id: string;
  creator_id: string;
  active_version: number | null;
  management_revision: string;
  storage_table: string | null;
};
/** 记录实际保留的存储身份，active:false 的列仍参与后续重建。 */
export type StorageManifest = {
  table: string;
  bindings: Array<StorageBinding & { active: boolean }>;
  relations: Array<RelationDefinition & { active: boolean; table?: string }>;
};
/** 将当前不可变定义与数据库头和物理 manifest 一起交给应用服务。 */
export type StoredModel = {
  head: ModelHead;
  definition: ModelDefinition;
  manifest: StorageManifest;
  version: number;
  revision: string;
};
