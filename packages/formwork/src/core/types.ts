import type { Accessor, Component, JSX } from "solid-js";
import type { FieldDescriptor, FieldContract, ResolvedModel } from "../model/field";
import type { FieldSchema, JsonValue, ModelDocument, OpenMode, Scene } from "../model/types";
import type { DataClient, FormworkApis, ModelSnapshot, RecordSnapshot } from "../data/index";
import type {
  ComponentRegistry,
  RenderItemProps,
  ScopeOptions,
  ValueScope,
} from "../runtime/types";

/** 声明一个场景使用的组件名称与展示参数。 */
export type FieldPresentation = { component?: string; props?: Record<string, JsonValue> };
/** 保存应用提供的字段映射，不包含框架内置视觉默认值。 */
export type FieldMapping = Partial<Record<Scene, FieldPresentation | false>>;
/** 提供直接可修改的场景配置；隐藏状态仍使用 false。 */
export type PreparedField = Omit<
  FieldSchema,
  "ui" | "properties" | "items" | "additionalProperties"
> & {
  ui: Record<Scene, FieldPresentation | false>;
  properties?: Record<string, PreparedField>;
  items?: PreparedField;
  additionalProperties?: false | PreparedField;
};
/** 为每一轮加工提供独立 Schema 副本和只读来源。 */
export type SchemaContext = {
  readonly modelId: string;
  readonly router?: string;
  readonly sourceSchema: ModelDocument;
  readonly signal: AbortSignal;
  schema: Omit<ModelDocument, "data" | "$defs"> & {
    data: Record<string, PreparedField>;
    $defs?: Record<string, PreparedField>;
  };
};
/** 修改 ctx.schema 后返回 ctx；app、Domain、局部加工按此顺序运行。 */
export type SchemaTransform = (context: SchemaContext) => SchemaContext | Promise<SchemaContext>;
/** 绑定已加载模型的字段能力，不保存当前记录和编辑草稿。 */
export type ModelContext = SchemaContext & {
  snapshot: ModelSnapshot;
  model: ResolvedModel;
  data: DataClient;
  RenderItem: Component<RenderItemProps>;
  createScope: (options?: ScopeOptions) => ValueScope;
};
/** 提供普通页面需要的导航和数据入口，不隐式加载模型。 */
export type PageContext = {
  router: string;
  data: DataClient;
  signal: AbortSignal;
  query: Accessor<URLSearchParams>;
  navigate: (path: string) => void;
  confirm: (message: string) => Promise<boolean>;
  /** 返回 true 表示存在未保存修改；返回的函数用于注销守卫。 */
  guard: (check: () => boolean) => () => void;
};
/** 按明确 router 定义模型布局，与 schema.domain 业务分类无关。 */
export type DomainDefinition = {
  router: string;
  render: Component<ModelContext>;
  transformSchema?: SchemaTransform;
};
/** 声明固定路径 /router 的普通页面，参数通过 query 传递。 */
export type PageDefinition = { router: string; render: Component<PageContext> };
/** 将视觉组件与行为状态连接，所有名称均来自 components。 */
export type FormworkUI = {
  shell?: string;
  fieldContainer?: string;
  types?: Record<string, FieldMapping>;
  formats?: Record<string, FieldMapping>;
  selectField?: (input: {
    field: FieldSchema;
    scene: Scene;
  }) => FieldPresentation | false | undefined;
  records?: {
    layout?: string;
    filter?: string;
    table?: string;
    actions?: string;
    pagination?: string;
  };
  detail?: { layout?: string };
  editor?: { layout?: string };
  presenters?: Partial<Record<OpenMode, string>>;
  feedback?: { loading?: string; empty?: string; error?: string; confirm?: string };
};
/** 显式装配数据、组件、领域和普通页面；无注册项时传空数组。 */
export type FormworkDefinition = FieldContract & {
  apis: FormworkApis;
  components: ComponentRegistry;
  ui: FormworkUI;
  domains: readonly DomainDefinition[];
  pages: readonly PageDefinition[];
  transformSchema?: SchemaTransform;
};
/** 保存无副作用的应用声明；每次 Formwork 挂载创建独立运行环境。 */
export type FormworkApplication = Readonly<FormworkDefinition>;
/** 承载一次记录操作，close 先经过此操作注册的未保存守卫。 */
export type RecordOperation = {
  operationId: string;
  modelId: string;
  recordId?: string;
  mode: "detail" | "create" | "edit";
  model: ModelContext;
  signal: AbortSignal;
  close: () => Promise<boolean>;
  complete: (record: RecordSnapshot) => void;
  guard: (check: () => boolean) => () => void;
  presentation: OpenMode;
  direct: boolean;
};
/** 只在操作激活时创建内容，false 同时禁用动作与直达入口。 */
export type RecordSlots = {
  detail?: ((operation: RecordOperation & { recordId: string }) => JSX.Element) | false;
  create?: ((operation: RecordOperation) => JSX.Element) | false;
  edit?: ((operation: RecordOperation & { recordId: string }) => JSX.Element) | false;
};
/** 为 app Presenter 提供统一关闭、直达和挂载边界。 */
export type PresenterProps = {
  children?: JSX.Element;
  operation: RecordOperation;
  close: () => Promise<boolean>;
  direct: boolean;
  portalTarget?: HTMLElement;
};
/** 支持独立 Page 消费模型能力，也允许从当前 Domain 继承。 */
export type ModelOptions = {
  modelId?: string;
  router?: string;
  transformSchema?: SchemaTransform;
};
/** 为表单字段提供应用可以直接组合的描述和绑定。 */
export type EditorField = { field: FieldDescriptor; scope: ValueScope; readOnly: boolean };
