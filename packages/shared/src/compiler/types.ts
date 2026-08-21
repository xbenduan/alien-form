import type { DataSourceItem, IFieldSchema, IFormSchema } from "@alien-form/react";
import type { GroupConfig, TableColumn } from "../types";

// ─── 场景与语言 ────────────────────────────────────────────────────────────

/** 编译投影的目标场景。detail 复用 form（渲染时切只读态）。 */
export type Scene = "form" | "filter" | "table";

export type Locale = "zh" | "en" | (string & {});

// ─── 后端配置态 schema（原 services/types 下沉至此，shared 作为唯一来源）──────

/** table 列展示元信息。 */
export interface TableFieldMeta {
  width?: number;
  ellipsis?: boolean;
  sortable?: boolean;
  visible?: boolean;
}

/** filter 筛选区展示元信息。 */
export interface FilterFieldMeta {
  visible?: boolean;
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
export interface ModelFieldSchema extends Omit<IFieldSchema, "dataSource" | "properties" | "items"> {
  key?: string;
  "x-table"?: TableFieldMeta;
  "x-filter"?: FilterFieldMeta;
  /** 静态选项数组，或 $af-dataSource 插件 marker。 */
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
export interface ModelSchema extends Omit<IFormSchema, "properties"> {
  meta: ModelMeta;
  properties: Record<string, ModelFieldSchema>;
  group?: GroupConfig[];
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

/**
 * 组件自取数据源的声明（props 方案）：纯可序列化数据，不含闭包，
 * 由组件通过 FieldServiceContext 注入的 request 消费。
 */
export interface FieldService {
  model: string;
  valueKey: string;
  labelKey: string;
  /** true 时组件走远程搜索（onSearch），false 时前端本地过滤。 */
  remoteSearch: boolean;
}

// ─── resolve 上下文（插件运行时）────────────────────────────────────────────

/** 预取阶段上下文：与场景无关，仅用于把远程请求灌进共享缓存。 */
export interface PrefetchCtx {
  schema: ModelSchema;
  locale: Locale;
  /** 是否真实拉取远程数据（构建器预览传 false 以跳过 fetch）。 */
  resolveData: boolean;
  request: RequestFn;
  /** 单次 compile 的共享态（跨场景共享预取结果，随 compile 结束丢弃）。 */
  store: Record<string, unknown>;
}

export interface ResolveCtx extends PrefetchCtx {
  /** 当前 marker 在 schema 中的位置（deep path）。 */
  path: (string | number)[];
  scene: Scene;
  /** 向当前场景 schema 的任意路径写入值（如 props 方案写 props.service）。 */
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
  projectProperties: (
    properties: Record<string, ModelFieldSchema>,
  ) => Record<string, IFieldSchema>;
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
}

// ─── 编译产物 ────────────────────────────────────────────────────────────────

/** compile 一次出全套：form / filter / table 三场景 + 已解析的 meta。 */
export interface Compiled {
  meta: ModelMeta;
  form: IFormSchema;
  filter: IFormSchema;
  columns: TableColumn[];
}

/** compile 选项。 */
export interface CompileOptions {
  locale?: Locale;
  /** 默认 true；false 跳过外键 fetch（构建器预览用）。 */
  resolveData?: boolean;
}

/** SchemaCompiler 构造上下文。 */
export interface SchemaCompilerContext {
  request: RequestFn;
  /** 拉取原始 schema（getSchema modelCode）。 */
  loadSchema?: (modelCode: string) => Promise<ModelSchema>;
  plugins?: AlienPlugin[];
  descriptors?: FieldDescriptor[];
  /** 编辑态 uid 生成器（注入以隔离唯一的可变状态）。 */
  idFactory?: () => string;
  locale?: Locale;
}
