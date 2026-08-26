import type { DataSourceItem, IFieldSchema, IFormSchema } from "@alien-form/react";
import type { GroupConfig, TableColumn } from "../../types/shared";

// ─── 场景与语言 ────────────────────────────────────────────────────────────

/** 编译投影的目标场景。detail 复用 form（渲染时切只读态）。 */
export type Scene = "form" | "filter" | "table";

/**
 * 页面级 UI 协议节点。协议唯一真相源为 runtime（@alien-form/engine 的 UiNode）：
 * 节点即 { component, props?, children?, slots? }，不再包 $af-ui 插件标记。
 * 运行时只负责按 component 查找已注册实现，编译产物可直接塞进 PageSchema.layout。
 *
 * 根节点（layout）通过 props.services 声明语义化 service 映射：
 * key 为布局语义（见 LAYOUT_SERVICE_KEYS），value 为已注册的 service code。
 * 子组件按语义 key 自取数据，不再在组件实现里写死 service code。
 */
export interface AfUiNode {
  component: string;
  props?: Record<string, unknown>;
  block?: string;
  visible?: string;
  children?: AfUiNode[];
  slots?: Record<string, AfUiNode[]>;
}

/** 语义 key → 已注册 service code 的映射，由布局根节点 props.services 持有。 */
export type LayoutServiceMap = Record<string, string>;

/**
 * 布局内建的 service 语义 key。根节点 props.services 必须声明数据类组件所需的 key。
 *  - query.list：表格列表查询
 *  - query.filter：筛选区数据源（多数场景与 query.list 同源）
 *  - query.detail：单条详情
 *  - query.subtree：树的子树查询（配置了 left 树栏的布局专用）
 *  - create.record / update.record / delete.record / delete.recordMany：写操作
 */
export const LAYOUT_SERVICE_KEYS = {
  LIST: "query.list",
  FILTER: "query.filter",
  DETAIL: "query.detail",
  SUBTREE: "query.subtree",
  CREATE: "create.record",
  UPDATE: "update.record",
  DELETE: "delete.record",
  DELETE_MANY: "delete.recordMany",
} as const;

/**
 * 内置记录型页面的默认 service 映射。layout 根节点直接使用；
 * 配置了 left 树栏的布局在此基础上追加 query.subtree。
 */
export const DEFAULT_RECORD_SERVICES: LayoutServiceMap = {
  [LAYOUT_SERVICE_KEYS.LIST]: "records.list",
  [LAYOUT_SERVICE_KEYS.FILTER]: "records.list",
  [LAYOUT_SERVICE_KEYS.DETAIL]: "records.get",
  [LAYOUT_SERVICE_KEYS.CREATE]: "records.create",
  [LAYOUT_SERVICE_KEYS.UPDATE]: "records.update",
  [LAYOUT_SERVICE_KEYS.DELETE]: "records.delete",
  [LAYOUT_SERVICE_KEYS.DELETE_MANY]: "records.deleteMany",
};

export type Locale = "zh" | "en" | (string & {});

// ─── 后端配置态 schema（原 services/types 下沉至此，shared 作为唯一来源）──────

/** table 列展示元信息。 */
export interface TableFieldMeta {
  width?: number;
  ellipsis?: boolean;
  sortable?: boolean;
  visible?: boolean;
}

/**
 * x-database：字段的「后端存储事实」声明。
 * 前端只消费其中影响投影的两个信号：
 *  - filterable（缺省跟随 index）：字段是否进入 filter 筛选区；
 *  - sortable：表格列是否可排序。
 * 其余（列类型、关系、约束等）由后端解释，前端透传。
 */
export interface XDatabaseMeta {
  type?: string;
  nullable?: boolean;
  default?: string | number | boolean;
  unique?: boolean;
  index?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  relation?: "many-to-one" | "many-to-many";
  target?: string;
  through?: string;
}

/** 详情/新增/编辑的打开方式。 */
export type OpenMode = "page" | "drawer" | "modal";

/** 模型分组（落地页归类）。 */
export type ModelGroup = "system" | "other";

/** 模型元信息：驱动列表页标题、分页、打开方式等。 */
export interface ModelMeta {
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
  group?: ModelGroup;
  singularLabel: string;
  pluralLabel: string;
  defaultPageSize: number;
  filterCount?: number;
  openMode: Record<"add" | "edit" | "detail", OpenMode>;
}

/**
 * 模型字段：alien-form 协议字段 + CMS 扩展元信息。
 * dataSource / title / description / props.* 等位置可承载插件 marker（见 PluginMarker）。
 */
export interface ModelFieldSchema extends Omit<
  IFieldSchema,
  "dataSource" | "properties" | "items"
> {
  key?: string;
  "x-table"?: TableFieldMeta;
  /** 后端存储事实：驱动 filter 可见（filterable）与列可排序（sortable）。 */
  "x-database"?: XDatabaseMeta;
  /** 静态选项数组，或通用插件 marker（例如 $af-constant）。 */
  dataSource?: DataSourceItem[] | PluginMarker;
  properties?: Record<string, ModelFieldSchema>;
  items?: ModelFieldSchema | ModelFieldSchema[];
}

/** 多语言字典：key → 各语言文案。 */
export type I18nDict = Record<string, Partial<Record<Locale, string>>>;

/**
 * 模型 schema：配置态 schema（properties + group）+ 模型元信息 + 多语言字典。
 * 一份 schema 经 SchemaCompiler 投影出 form / table / filter 三个场景。
 */
export interface ModelSchema extends Omit<IFormSchema, "properties" | "x-layout"> {
  meta: ModelMeta;
  properties: Record<string, ModelFieldSchema>;
  group?: GroupConfig[];
  "x-layout": AfUiNode;
  /** 多语言字典，供 $af-i18n 插件消费。 */
  i18n?: I18nDict;
}

// ─── 插件 marker 协议 ───────────────────────────────────────────────────────

/**
 * 插件占位标记：schema 中任意位置只要是形如 { plugin: "$xxx", ... } 的对象，
 * 都被 resolve 阶段识别为一个插件调用点，按 plugin 名派发给对应插件。
 */
export interface PluginMarker {
  plugin: string;
  [key: string]: unknown;
}

export function isPluginMarker(value: unknown): value is PluginMarker {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { plugin?: unknown }).plugin === "string"
  );
}

// ─── 数据请求（handler 预取 / 组件 service 自取，共用同一签名）─────────────────

export interface RequestInput {
  model: string;
  filters?: Record<string, unknown>;
  pagination?: { current: number; pageSize: number };
}

export interface RequestResult {
  list: Record<string, unknown>[];
  total: number;
}

export type RequestFn = (input: RequestInput) => Promise<RequestResult>;

export interface ServiceClient {
  send: (params?: unknown, options?: unknown) => Promise<unknown>;
}

export type ServiceResolver = (code: string) => ServiceClient | undefined;

export type ConstantResolver = (key: string) => unknown;

/**
 * 组件自取数据源的声明：纯可序列化数据，不含闭包，
 * 由组件通过 FieldServiceContext 注入的 request 消费。
 */
export interface FieldService {
  model: string;
  valueKey: string;
  labelKey: string;
}

// ─── resolve 上下文（插件运行时）────────────────────────────────────────────

/** 预取阶段上下文：与场景无关，仅用于把远程请求灌进共享缓存。 */
export interface PrefetchCtx {
  schema: ModelSchema;
  locale: Locale;
  /** 是否真实拉取远程数据（构建器预览传 false 以跳过 fetch）。 */
  resolveData: boolean;
  service: ServiceResolver;
  constant: ConstantResolver;
  /** 单次 compile 的共享态（跨场景共享预取结果，随 compile 结束丢弃）。 */
  store: Record<string, unknown>;
}

export interface ResolveCtx extends PrefetchCtx {
  /** 当前 marker 在 schema 中的位置（deep path）。 */
  path: (string | number)[];
  scene: Scene;
  /** 向当前场景 schema 的任意路径写入值。 */
  patch: (path: (string | number)[], value: unknown) => void;
}

/**
 * 插件：name 作为 marker.plugin 的路由 key。
 *  - prefetch（可选）：预取阶段并发触发远程请求，结果写入 ctx.store。
 *  - resolve：拿到 marker 与其位置，返回替换值（同步或异步）。
 *  - order：控制同一节点多插件的执行顺序。
 */
export interface AlienPlugin {
  name: string;
  order?: number;
  prefetch?: (marker: PluginMarker, ctx: PrefetchCtx) => Promise<void>;
  resolve: (marker: PluginMarker, ctx: ResolveCtx) => unknown | Promise<unknown>;
}

// ─── 字段描述符（场景投影的唯一来源）────────────────────────────────────────

export interface DescriptorCtx {
  scene: Scene;
  locale: Locale;
  /** 递归投影子 properties（容器字段用）。 */
  projectProperties: (properties: Record<string, ModelFieldSchema>) => Record<string, IFieldSchema>;
}

/**
 * 字段描述符：一种字段类型「在各场景怎么投影」就地声明一次。
 * 新增字段类型 = 加一条描述符，form / filter / table 自动跟上。
 */
export interface FieldDescriptor {
  name: string;
  match: (field: ModelFieldSchema) => boolean;
  /** form 渲染语义（含 detail，只读态由渲染层切换）。 */
  toForm: (field: ModelFieldSchema, ctx: DescriptorCtx) => IFieldSchema;
  /** filter 渲染语义；返回 undefined 表示该字段不进筛选区。 */
  toFilter: (field: ModelFieldSchema, key: string, ctx: DescriptorCtx) => IFieldSchema | undefined;
  /** table 列定义（key 由调用方补齐）。 */
  toColumn: (field: ModelFieldSchema, key: string, ctx: DescriptorCtx) => TableColumn;
}

// ─── 编辑态草稿（构建器 draft ⇄ schema）──────────────────────────────────────

export interface FieldDraft {
  id: string;
  fields: ModelFieldSchema;
  children?: FieldDraft[];
}

export interface GroupDraft {
  id: string;
  title: string;
  component: string;
  keys: string[];
  gridSpan: number;
}

export interface ModelDraft {
  name: string;
  title: string;
  subtitle: string;
  description: string;
  group: ModelGroup;
  singularLabel: string;
  pluralLabel: string;
  defaultPageSize: number;
  filterCount: number;
  openMode: Record<"add" | "edit" | "detail", OpenMode>;
  fields: FieldDraft[];
  groups: GroupDraft[];
  layout: AfUiNode;
}

// ─── 编译产物 ────────────────────────────────────────────────────────────────

/** compile 一次出全套：form / filter / table 三场景 + 已解析的 meta。 */
export interface Compiled {
  meta: ModelMeta;
  form: IFormSchema;
  filter: IFormSchema;
  columns: TableColumn[];
  layout: AfUiNode;
}

/** compile 选项。 */
export interface CompileOptions {
  locale?: Locale;
  /** 默认 true；false 跳过外键 fetch（构建器预览用）。 */
  resolveData?: boolean;
}

/** SchemaCompiler 构造上下文。 */
export interface SchemaCompilerContext {
  service: ServiceResolver;
  constant: ConstantResolver;
  /** 拉取原始 schema（getSchema modelCode）。 */
  loadSchema?: (modelCode: string) => Promise<ModelSchema>;
  plugins?: AlienPlugin[];
  descriptors?: FieldDescriptor[];
  /** 编辑态 uid 生成器（注入以隔离唯一的可变状态）。 */
  idFactory?: () => string;
  locale?: Locale;
}
