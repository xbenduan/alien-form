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
  type: Nullable<"object">;
  properties: Record<string, DataSchema>;
  required?: readonly string[];
  additionalProperties?: false | DataSchema;
  $defs?: Record<string, DataSchema>;
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
    | {
        type: Nullable<"array">;
        items: DataSchema;
        minItems?: number;
        maxItems?: number;
        uniqueItems?: boolean;
      }
    | { $ref: string }
  );
/** 标识字段的展示场景，独立于当前是否允许编辑。 */
export type Scene = "form" | "filter" | "table" | "detail";
/** 描述枚举候选，记录始终保存 value。 */
export type EnumOption = { value: Scalar; label: string };
/** 描述一次业务引用，目标地址均为 JSON Pointer。 */
export type FieldRelation = { model: string; valueField?: string; labelField?: string };
/** 保存不能由字段推导的物理存储例外。 */
export type FieldStorage = {
  column?: string;
  jsonKey?: string;
  index?: "index" | "unique";
  through?: string;
};
/** 定义前后端及所有场景共用的一个字段；required 属于当前属性。 */
export type FieldSchema = SchemaMetadata & {
  type?: "string" | "number" | "integer" | "boolean" | "object" | "array" | "null";
  $ref?: string;
  id?: string;
  required?: boolean;
  nullable?: boolean;
  format?: string;
  enum?: readonly (Scalar | EnumOption)[];
  relation?: FieldRelation;
  props?: Record<string, JsonValue>;
  ui?: Partial<Record<Scene, false | { component?: string }>>;
  query?: { filter?: false; sort?: false };
  storage?: FieldStorage;
  properties?: Record<string, FieldSchema>;
  items?: FieldSchema;
  additionalProperties?: false | FieldSchema;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
};
/** 描述记录的父级与名称字段，不包含页面布局；两个 Pointer 均指向根字段。 */
export type TreeDefinition = { parentField: string; labelField: string };
/** 选择完整页面、抽屉或弹窗来承载同一份 Window 内容。 */
export type OpenMode = "page" | "drawer" | "modal";
/** 以 Page 与本地 Window 名定位一个注册目标。 */
export type RouteTarget = { router: string; window?: string };
/** 保存持久化业务描述；发布版本和权限由 API envelope 承载。 */
export type ModelDocument = {
  schemaVersion: 1;
  id: string;
  domain?: string;
  title: string;
  data: Record<string, FieldSchema>;
  $defs?: Record<string, FieldSchema>;
  tree?: TreeDefinition;
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
  valueField?: string;
  labelField?: string;
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
/** 声明模型级权限、可信规则及特殊表名；存储绑定和关系由字段编译。 */
export type BackendOptions = {
  storage?: { table?: string };
  permissions?: BackendDefinition["permissions"];
  behavior?: Partial<BackendDefinition["behavior"]>;
};
/** 保存唯一的作者协议，管理接口可以额外携带后端策略。 */
export type ModelDefinition = ModelDocument & { backend?: BackendOptions };
/** 保存内部值 Schema，禁止作为作者协议写入管理接口。 */
export type CompiledDocument = Omit<ModelDocument, "data" | "$defs"> & {
  data: ObjectSchema & SchemaMetadata;
};
/** 将作者原文与服务端需要的派生产物一起保存。 */
export type CompiledDefinition = {
  schema: ModelDefinition;
  document: CompiledDocument;
  backend: BackendDefinition;
};
/** 保存尚未通过发布校验的 JSON 定义；id 是唯一强制业务字段。 */
export type DraftDefinition = {
  id: string;
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
  capabilities: RecordCapabilities;
};
/** 返回管理预览 schema；草稿不伪造发布版本。 */
export type PreviewSnapshot = {
  schema: ModelDocument;
  managementRevision: string;
  stage: "draft" | "published";
  baseVersion: number | null;
  capabilities: RecordCapabilities;
};
/** 保存当前实例使用的字段协议；代码 props 在调用 RenderItem 时传入。 */
export type RuntimeSchema = ModelDocument;
/** 列出内建查询操作，operand 与记录校验相互独立。 */
export type QueryOperator = "eq" | "in" | "contains" | "between" | "isNull" | "isNotNull";
/** 描述当前身份与 adapter 实际支持的单字段能力。 */
export type FieldCapabilities = {
  read: boolean;
  create?: boolean;
  update?: boolean;
  filter: readonly QueryOperator[];
  sort: boolean;
};
/** 保存与当前发布版本绑定的记录能力。 */
export type RecordCapabilities = { fields: Record<string, FieldCapabilities> };
/** 定义一个已启用的查询条件；空值操作不带 operand。 */
export type QueryClause = { field: string; operator: QueryOperator; operand?: JsonValue };
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
  window?: string;
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
  window?: string;
  domain?: string;
  components: readonly CapabilityMember[];
  fn: readonly CapabilityMember[];
  formats: readonly CapabilityMember[];
  modelSchema?: CapabilityMember;
  pageLoader?: CapabilityMember;
  domainTransform?: CapabilityMember;
  valueLoader?: CapabilityMember;
  modelContract: string;
  runtimeChecks: readonly Diagnostic[];
};
/** 保存一层代码能力和需要运行时执行的检查，不含模型快照。 */
export type CapabilityLayer = {
  components: readonly CapabilityMember[];
  fn: readonly CapabilityMember[];
  formats?: readonly CapabilityMember[];
  modelSchema?: CapabilityMember;
  getSchema?: CapabilityMember;
  transformSchema?: CapabilityMember;
  getValue?: CapabilityMember;
  runtimeChecks: readonly Diagnostic[];
};
/** 保存注册 Page 及本地 Window 的静态能力。 */
export type PageCapabilities = {
  path: string;
  model: boolean;
  capabilities: CapabilityLayer;
  windows: Record<
    string,
    {
      path: string;
      model: boolean;
      openMode: OpenMode;
      capabilities: CapabilityLayer;
    }
  >;
};
/** 保存声明层和注册归属，在读取模型文档后选择实际 Domain。 */
export type CapabilityManifest = {
  formatVersion: 2;
  appId: string;
  revision: string;
  clientOrigin: string;
  presenters: readonly OpenMode[];
  framework: CapabilityLayer;
  domains: Record<string, CapabilityLayer>;
  pages: Record<string, PageCapabilities>;
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
  clauses: readonly QueryClause[];
  page: number;
  pageSize: number;
  sort?: { field: string; direction: "asc" | "desc" };
  keyword?: string;
  parentId?: string;
};
/** 保存授权后的记录及服务端身份字段。 */
export type RecordValue = Record<string, JsonValue>;
/** 部分更新根字段，unset 中的 Pointer 明确删除属性；例如 { unset:["/summary"] }。 */
export type RecordPatch = { set?: RecordValue; unset?: readonly string[] };
/** 按关系字段搜索候选或批量解析已有原始值，fieldId 也接受字段 Pointer。 */
export type RelationOptionsInput = {
  fieldId: string;
  keyword?: string;
  selectedValues?: readonly (string | number | boolean)[];
  limit?: number;
};
/** 返回允许当前身份看到的候选标签，不夹带目标记录的其他字段。 */
export type RelationOptionsResult = { options: EnumOption[]; total: number };
/** 返回分页记录与筛选后的总数。 */
export type RecordPage = { list: RecordValue[]; total: number };
