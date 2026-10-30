/** 表示模型和记录可以保存的 JSON 值。 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
type Scalar = string | number | boolean | null;
type Nullable<T extends string> = T | readonly [T, "null"];
/** 提供业务值的展示说明、默认值及写入限制。 */
export type SchemaMetadata = {
  title?: string;
  description?: string;
  default?: JsonValue;
  readOnly?: boolean;
};
/** 描述具名字段；properties 的顺序决定默认展示顺序。 */
export type ObjectSchema = {
  type: "object";
  properties: Record<string, DataSchema>;
  required?: readonly string[];
  additionalProperties?: false;
};
/** 描述业务值；所有本地 $ref 均相对根 data 解析。 */
export type DataSchema = SchemaMetadata &
  (
    | {
        type: Nullable<"string">;
        enum?: readonly Scalar[];
        minLength?: number;
        maxLength?: number;
        pattern?: string;
      }
    | {
        type: Nullable<"number" | "integer">;
        enum?: readonly Scalar[];
        minimum?: number;
        maximum?: number;
      }
    | { type: Nullable<"boolean">; enum?: readonly Scalar[] }
    | { type: "null" }
    | ObjectSchema
    | { type: "array"; items: DataSchema; minItems?: number; maxItems?: number }
    | { $ref: string }
  );
/** 描述组件树，field 使用相对当前 object 或 item 根的 JSON Pointer。 */
export type ViewNode = {
  component: string;
  field?: string;
  props?: Record<string, JsonValue>;
  bindings?: {
    value?: string;
    readOnly?: boolean | string;
    disabled?: boolean | string;
    visible?: boolean | string;
  };
  children?: readonly ViewNode[];
};
/** 保存持久化业务描述；发布版本和权限由 API envelope 承载。 */
export type ModelDocument = {
  id: string;
  title: string;
  data: ObjectSchema & SchemaMetadata & { $defs?: Record<string, DataSchema> };
  views?: Record<string, ViewNode>;
};
/** 描述字段的稳定存储身份；path 为根字段 Pointer，停用字段保留物理数据。 */
export type StorageBinding = {
  id: string;
  path: string;
  column?: string;
  jsonKey?: string;
  sqlType: "TEXT" | "INTEGER" | "REAL";
  encoding: "scalar" | "json";
  index?: "index" | "unique";
};
/** 通过稳定字段身份描述模型关系。 */
export type RelationDefinition = {
  fieldId: string;
  targetModel: string;
  targetFieldId: string;
  kind: "many-to-one" | "many-to-many";
  through?: string;
};
/** 表示服务端可以授权的独立操作。 */
export type ModelAction = "read" | "create" | "update" | "delete" | "manage" | "publish";
/** 保存版本化角色授权；未声明 fields 表示全部非私有字段。 */
export type RoleGrant = {
  roleId: string;
  actions: readonly ModelAction[];
  fields?: readonly string[];
  scope: "all" | "own";
};
/** 定义存储、关系、权限和可信 Worker 规则引用，不承载可执行源码。 */
export type BackendDefinition = {
  storage: { table: string; bindings: readonly StorageBinding[] };
  relations: readonly RelationDefinition[];
  permissions: { grants: readonly RoleGrant[]; privateFields: readonly string[] };
  behavior: {
    rules: readonly string[];
    commands: Record<string, string>;
    events: Record<string, readonly string[]>;
  };
};
/** 保存完整的后端管理定义。 */
export type ModelDefinition = { document: ModelDocument; backend: BackendDefinition };
/** 保存尚未通过发布校验的 JSON 定义；document.id 是唯一强制业务字段。 */
export type DraftDefinition = {
  document: { id: string; [key: string]: JsonValue };
  backend?: JsonValue;
  [key: string]: JsonValue | undefined;
};
/** 提供最新共享管理状态及其 CAS revision。 */
export type ManagedEntry = {
  id: string;
  title: string;
  revision: string;
  stage: "draft" | "published";
  publishedVersion: number | null;
  canManage: boolean;
  canPublish: boolean;
};
/** 返回最新草稿或最新发布定义，诊断不阻止草稿读取。 */
export type ManagedSnapshot = ManagedEntry & {
  definition: DraftDefinition;
  baseVersion: number | null;
  diagnostics: ValidationReport;
};
/** 返回不可变且完整有效的发布版本。 */
export type PublishedSnapshot = {
  id: string;
  version: number;
  revision: string;
  definition: ModelDefinition;
};
/** 返回授权后用于普通页面加载的 schema，不暴露 backend。 */
export type RuntimeSnapshot = {
  schema: ModelDocument;
  version: number;
  revision: string;
};
/** 返回管理预览 schema；草稿不伪造发布版本。 */
export type PreviewSnapshot = {
  schema: ModelDocument;
  managementRevision: string;
  stage: "draft" | "published";
  baseVersion: number | null;
};
/** 允许 Domain 在当前实例的 View props 中保留代码值。 */
export type RuntimeView = Omit<ViewNode, "props" | "children"> & {
  props?: Record<string, unknown>;
  children?: readonly RuntimeView[];
};
/** 表示 Domain 加工后实际渲染的 schema，data 仍使用纯 JSON 契约。 */
export type RuntimeSchema = Omit<ModelDocument, "views"> & {
  views?: Record<string, RuntimeView>;
};
/** 允许取消 HTTP 请求。 */
export type ReadOptions = { signal?: AbortSignal };
/** 条件保存共享草稿；ifRevision:null 只允许创建不存在的模型。 */
export type WriteOptions = ReadOptions & { ifRevision: string | null };
/** 定位 scope 值或模型配置中的问题。 */
export type ValidationIssue = { path: string; code: string; message: string };
/** 为工具诊断补充模型、路由与源码位置。 */
export type Diagnostic = ValidationIssue & {
  modelId?: string;
  router?: string;
  source?: { file: string; line: number; column: number };
};
/** 汇总可确定错误与需要浏览器实际执行的行为。 */
export type ValidationReport = {
  errors: readonly Diagnostic[];
  runtimeChecks: readonly Diagnostic[];
};
/** 保存能力声明的位置和覆盖链，不猜测 TS 类型约束。 */
export type CapabilityMember = {
  name: string;
  source: NonNullable<Diagnostic["source"]>;
  declaration: string;
  jsDoc?: string;
  overrides?: readonly NonNullable<Diagnostic["source"]>[];
};
/** 返回指定模型与路由实际可用的静态能力。 */
export type EffectiveCapabilities = {
  modelId: string;
  router: string;
  components: readonly CapabilityMember[];
  fn: readonly CapabilityMember[];
  schema?: CapabilityMember;
  pageLoader?: CapabilityMember;
  domainTransform?: CapabilityMember;
  modelContract: string;
  runtimeChecks: readonly Diagnostic[];
};
/** 保存数据库中的应用代码能力清单，不含模型快照。 */
export type CapabilityManifest = {
  appId: string;
  revision: string;
  clientOrigin: string;
  routes: readonly {
    router: string;
    path?: string;
    presentation?: "page" | "modal" | "drawer";
    returnTo?: string;
  }[];
  schemaRouters: readonly string[];
  defaultCapabilities: Record<string, EffectiveCapabilities>;
  domainCapabilities: Record<string, Record<string, EffectiveCapabilities>>;
};
/** 返回可信身份及其模型创建能力。 */
export type ActorSummary = {
  id: string;
  username: string;
  kind: "user" | "agent" | "deploy";
  super: boolean;
  canCreateModel: boolean;
};
/** 提供菜单中已发布模型的身份与展示名称。 */
export type ModelNavigationEntry = { id: string; title: string };
/** 返回当前账号可读取的系统模型、固定模型和可固定范围。 */
export type ModelNavigationSnapshot = {
  systemModels: ModelNavigationEntry[];
  pinnedModels: ModelNavigationEntry[];
  pinnableModelIds: string[];
};
/** 返回本人 credential 的可公开目录信息。 */
export type CredentialEntry = {
  id: string;
  label: string;
  kind: "user" | "agent" | "deploy";
  expiresAt: string;
  revokedAt: string | null;
};
/** 描述参数化记录查询；filter 值按 schema 类型解释。 */
export type RecordQuery = {
  filters: Record<string, JsonValue>;
  page: number;
  pageSize: number;
  sort?: { field: string; direction: "asc" | "desc" };
  keyword?: string;
  parentId?: string;
};
/** 保存授权后的记录及服务端身份字段。 */
export type RecordValue = Record<string, JsonValue>;
/** 返回分页记录与筛选后的总数。 */
export type RecordPage = { list: RecordValue[]; total: number };
