import type { Accessor, Component, JSX } from "solid-js";
import type { z } from "zod";
import type {
  DataSchema,
  JsonValue,
  ModelDocument,
  OpenMode,
  RuntimeSchema,
  RuntimeView,
  ValidationIssue,
} from "../model/types";
import type { FormworkApi } from "../model/http";
import type { FieldMode } from "../model/presentation";

/** 注册有效 View 可以引用的异构 Solid 组件。 */
export type ComponentRegistry = Record<string, Component<any>>;
/** 绑定当前 Instance 的应用行为函数。 */
export type BoundFn = Record<string, (...args: any[]) => any>;
/** 声明以当前 ActionContext 为首参的应用行为。 */
export type FnRegistry = Record<string, (ctx: ActionContext, ...args: any[]) => unknown>;
/** 保存一次挂载的路径参数快照。 */
export type RouteParams = Readonly<Record<string, string | undefined>>;
/** 提供代码导航时按路径段编码的参数。 */
export type Params = Readonly<Record<string, string>>;
/** 表示 Window 唯一的成功或取消终态。 */
export type WindowOutcome = { status: "completed"; value: unknown } | { status: "cancelled" };
/** 为本地 Window 补充路径参数和仅在内存中保存的输入快照。 */
export type OpenOptions = { params?: Params; initialValue?: JsonValue };
/** 为当前 Instance 的行为提供 schema、API、取消与导航能力。 */
export type ActionContext = {
  modelId?: string;
  domain?: string;
  router: string;
  window?: string;
  params: RouteParams;
  schema?: RuntimeSchema;
  api: FormworkApi;
  signal: AbortSignal;
  fn: BoundFn;
  navigate: (router: string, params?: Params) => void;
  open: (window: string, options?: OpenOptions) => Promise<WindowOutcome>;
  complete: (value: unknown) => void;
};
/** 在选择 Domain 前读取模型文档，不提供尚未解析的领域行为。 */
export type SchemaLoadContext = {
  modelId: string;
  router: string;
  params: RouteParams;
  api: FormworkApi;
  signal: AbortSignal;
};
/** 提供已确定数据身份的模型行为上下文。 */
export type PageLoadContext = ActionContext & { modelId: string };
/** 为 Domain 加工提供已加载、校验且独立的后端 schema。 */
export type DomainSchemaContext = PageLoadContext & { domain: string; schema: ModelDocument };
/** 为 Window loader 提供独立的行为绑定和可选输入快照。 */
export type WindowLoadContext = PageLoadContext & {
  window: string;
  schema: RuntimeSchema;
  initialValue?: JsonValue;
};
/** 表示校验结果；stale 不更新当前错误。 */
export type ValidationResult = {
  status: "valid" | "invalid" | "stale";
  issues: readonly ValidationIssue[];
};
/** 操作稳定身份的数组项，move 保留 scope 和 key。 */
export type ArrayHandle = {
  items: Accessor<readonly { key: string; scope: ValueScope }[]>;
  insert: (index: number, value?: JsonValue) => string;
  remove: (key: string) => void;
  move: (key: string, index: number) => void;
};
/** 持有独立值根；value 返回可复制、可序列化的普通 JSON 快照。 */
export type ValueScope = {
  value: Accessor<JsonValue | undefined>;
  errors: Accessor<readonly ValidationIssue[]>;
  set: (pointer: string, value: JsonValue | undefined) => void;
  reset: (value?: JsonValue) => void;
  validate: () => Promise<ValidationResult>;
  array: (pointer: string) => ArrayHandle;
};
/** 创建独立值集合，defaults:false 适用于查询和装载已有记录。 */
export type ScopeOptions = {
  schema?: DataSchema;
  value?: JsonValue;
  defaults?: boolean;
  readOnly?: boolean;
  validate?: (
    value: JsonValue | undefined,
    context: { signal: AbortSignal },
  ) => readonly ValidationIssue[] | Promise<readonly ValidationIssue[]>;
};
/** 为一次渲染提供根容器。 */
export type ContainerProps = { children?: JSX.Element };
/** 为字段提供标签、必填提示及当前路径的错误。 */
export type FieldContainerProps = ContainerProps & {
  path: string;
  title: string;
  /** 已解析的字段 Schema，供容器选择普通字段或对象、数组分组。 */
  schema?: DataSchema;
  required: boolean;
  errors: readonly ValidationIssue[];
};
/** 为值组件提供响应式受控属性，onChange 始终执行写入限制。 */
export type FieldProps = ContainerProps & {
  value: JsonValue | undefined;
  onChange: (value: JsonValue | undefined) => void;
  readOnly: boolean;
  disabled: boolean;
  errors: readonly ValidationIssue[];
  schema: DataSchema;
  array?: ArrayHandle;
  Item?: Component<{ scope: ValueScope }>;
};
/** 渲染当前 scope 的默认树、显式 View 或一个字段。 */
export type RenderProps = {
  mode?: FieldMode;
  scope?: ValueScope;
  container?: Component<ContainerProps>;
  fieldContainer?: Component<FieldContainerProps>;
  components?: ComponentRegistry;
} & ({ field: string; view?: never } | { view?: RuntimeView; field?: never });
/** 为模型内容提供共享 Render 和独立 scope。 */
export type PageContext = PageLoadContext &
  ContainerProps & {
    schema: RuntimeSchema;
    scope: ValueScope;
    Render: Component<RenderProps>;
    createScope: (options?: ScopeOptions) => ValueScope;
  };
/** 提供本地 Window 的独立模型内容和输入快照。 */
export type WindowContext = PageContext & { window: string; initialValue?: JsonValue };
/** 保存可以被近层覆盖的具名渲染和行为能力。 */
export type RenderDefaults = {
  fieldContainer?: Component<FieldContainerProps>;
  components?: ComponentRegistry;
  fn?: FnRegistry;
};
/** 保存可复用的领域能力、扩展模型校验和已加载文档加工。 */
export type DomainDefinition = RenderDefaults & {
  modelSchema?: z.ZodType<ModelDocument>;
  transformSchema?: (ctx: DomainSchemaContext) => RuntimeSchema | Promise<RuntimeSchema>;
};
/** 声明明确的模型覆盖及其延迟导入。 */
export type Domains = Record<
  string,
  DomainDefinition | (() => Promise<{ default: DomainDefinition }>)
>;
type DefinitionBase = RenderDefaults & {
  path?: string;
};
type SchemaBody<C extends Record<string, any> = PageContext> = {
  render?: never;
  container: Component<C>;
};
type PlainBody = {
  render: Component<ActionContext>;
  container?: never;
  fieldContainer?: never;
};
/** 声明可寻址的普通内容或模型内容。 */
export type PageDefinition = DefinitionBase & {
  router: string;
  windows?: Record<string, WindowDefinition>;
} & ((SchemaBody & { getSchema?: (ctx: SchemaLoadContext) => ModelDocument | Promise<ModelDocument> }) |
  (PlainBody & { getSchema?: never }));
/** 支持插件在 JSX 编译前转换直接 render 字面量。 */
export type PageAuthorDefinition = Omit<PageDefinition, "render"> & {
  render?: Component<ActionContext> | JSX.Element;
};
/** 声明所属 Page 的相对路径、默认打开方式与独立值加载。 */
export type WindowDefinition = DefinitionBase & {
  openMode?: OpenMode;
} & ((SchemaBody<WindowContext> & {
  readOnly?: boolean;
  getValue?: (ctx: WindowLoadContext) => JsonValue | undefined | Promise<JsonValue | undefined>;
}) | (PlainBody & { readOnly?: never; getValue?: never }));
/** 为 Window 提供相同的插件作者语法。 */
export type WindowAuthorDefinition = Omit<WindowDefinition, "render"> & {
  render?: Component<ActionContext> | JSX.Element;
};
/** 在当前 owner 内承载完整内容，close 进入取消终态。 */
export type PresenterProps = { children?: JSX.Element; direct: boolean; window?: string; close: () => void };
/** 装配应用定义、唯一 HTTP API 和三种 Presenter。 */
export type FormworkDefinition = RenderDefaults & {
  api: FormworkApi;
  getSchema?: (ctx: SchemaLoadContext) => ModelDocument | Promise<ModelDocument>;
  modelSchema?: z.ZodType<ModelDocument>;
  domains?: Domains;
  pages: readonly PageDefinition[];
  presenters: {
    page: Component<PresenterProps>;
    modal?: Component<PresenterProps>;
    drawer?: Component<PresenterProps>;
  };
};
/** 每次 render 在调用 owner 下创建独立应用状态。 */
export type FormworkApplication = { render: Component };
