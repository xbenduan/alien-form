import type { Accessor, Component, JSX } from "solid-js";
import type { z } from "zod";
import type {
  DataSchema,
  JsonValue,
  ModelDocument,
  ModelSource,
  ValidationIssue,
  ViewNode,
} from "../model/types";

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
/** 为当前 Instance 的行为提供模型、取消与导航能力。 */
export type ActionContext = {
  domain?: string;
  params: RouteParams;
  model?: ModelDocument;
  models: ModelSource;
  signal: AbortSignal;
  fn: BoundFn;
  navigate: (router: string, params?: Params) => void;
  open: (router: string, params?: Params) => Promise<WindowOutcome>;
  complete: (value: unknown) => void;
};
/** 为已确认 domain 的模型加载提供上下文。 */
export type LoadContext = ActionContext & { domain: string };
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
  scope?: ValueScope;
  container?: Component<ContainerProps>;
  fieldContainer?: Component<FieldContainerProps>;
  components?: ComponentRegistry;
} & ({ field: string; view?: never } | { view?: ViewNode; field?: never });
/** 为模型内容提供共享 Render 和独立 scope。 */
export type PageContext = LoadContext &
  ContainerProps & {
    model: ModelDocument;
    scope: ValueScope;
    Render: Component<RenderProps>;
    createScope: (options?: ScopeOptions) => ValueScope;
  };
/** 保存可以被近层覆盖的渲染与模型加载能力。 */
export type RenderDefaults = {
  container?: Component<PageContext>;
  fieldContainer?: Component<FieldContainerProps>;
  components?: ComponentRegistry;
  fn?: FnRegistry;
  schema?: z.ZodType<ModelDocument>;
  getSchema?: (ctx: LoadContext) => unknown | Promise<unknown>;
};
/** 保存一个模型的稀疏覆盖。 */
export type DomainDefinition = RenderDefaults;
/** 声明明确的模型覆盖及其延迟导入。 */
export type Domains = Record<
  string,
  DomainDefinition | (() => Promise<{ default: DomainDefinition }>)
>;
type DefinitionBase = {
  router: string;
  path?: string;
  components?: ComponentRegistry;
  fn?: FnRegistry;
  domains?: Domains;
};
type SchemaBody = RenderDefaults & { render?: never };
type PlainBody = {
  render: Component<ActionContext>;
  schema?: never;
  getSchema?: never;
  container?: never;
  fieldContainer?: never;
};
/** 声明可寻址的普通内容或模型内容。 */
export type PageDefinition = DefinitionBase & (SchemaBody | PlainBody);
/** 支持插件在 JSX 编译前转换直接 render 字面量。 */
export type PageAuthorDefinition = DefinitionBase &
  (SchemaBody | (Omit<PlainBody, "render"> & { render: Component<ActionContext> | JSX.Element }));
/** 固定 Window 的 presentation 和直达取消后的 Page。 */
export type WindowDefinition = PageDefinition & {
  presentation: "page" | "modal" | "drawer";
  returnTo: string;
};
/** 为 Window 提供相同的插件作者语法。 */
export type WindowAuthorDefinition = PageAuthorDefinition & {
  presentation: "page" | "modal" | "drawer";
  returnTo: string;
};
/** 在当前 owner 内承载完整内容，close 进入取消终态。 */
export type PresenterProps = { children?: JSX.Element; direct: boolean; close: () => void };
/** 装配应用定义、完整模型源和三种 Presenter。 */
export type FormworkDefinition = RenderDefaults & {
  models: ModelSource;
  pages: readonly PageDefinition[];
  windows?: readonly WindowDefinition[];
  presenters: {
    page: Component<PresenterProps>;
    modal?: Component<PresenterProps>;
    drawer?: Component<PresenterProps>;
  };
};
/** 每次 render 在调用 owner 下创建独立应用状态。 */
export type FormworkApplication = { render: Component };
