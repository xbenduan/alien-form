/**
 * 核心 schema 类型定义。core 只认识这些「本质字段结构 + x-* 行为协议」，
 * 不感知 UI / React / 场景（form / table / filter / detail）。
 */

/** 运行时上下文：rule 求值时注入。避免与 field 模块产生循环依赖，定义在此。 */
export interface RuntimeContext {
  /** 根字段。 */
  root: FieldLike;
  /** 当前求值字段（相对选择器基准）。 */
  self: FieldLike;
  /** 选择器解析（第 9 节）：相对 / 绝对 / userScope。 */
  get(selector: string): any;
  /** = createForm 传入的 scope，注入表达式 / 函数 rule 作用域。 */
  userScope: Record<string, any>;
  /** 四命名空间的具名处理器表。 */
  handlers: Handlers;
  /** 统一错误上报。 */
  onError: (e: unknown) => void;
}

/** 字段的最小结构约束，供 schema/runtime 层引用，避免依赖具体 Field 类。 */
export interface FieldLike {
  readonly path: string;
  value(): any;
  [k: string]: any;
}

/** 组件 / 装饰器：只写 key，或 [key, props]。 */
export type ComponentSpec = string | [key: string, props: Record<string, any>];

/** 数据源项。 */
export interface OptionItem {
  label: string;
  value: unknown;
  [k: string]: unknown;
}

/** 一切 x-* 求值单元的统一形态。 */
export type SchemaRule =
  | string
  | ((ctx: RuntimeContext) => any)
  | number
  | boolean
  | null
  | object
  | any[];

/** x-reactions 可驱动的字段状态白名单（唯一权威来源）。 */
export type ReactionKey =
  | "value"
  | "display"
  | "disabled"
  | "title"
  | "description"
  | "component"
  | "decorator"
  | "options";

/** 单条联动：把某个状态 target 绑定到一条 rule 的求值结果。 */
export interface SchemaReaction {
  target: ReactionKey;
  rule: SchemaRule;
}

/** 内置对象校验规则。 */
export interface ObjectValidatorRule {
  message?: string;
  required?: boolean;
  max?: number;
  min?: number;
  pattern?: string;
}

/** 单条校验规则：对象内置规则，或统一 SchemaRule。 */
export type ValidatorRule = ObjectValidatorRule | SchemaRule;

/** 字段 schema。 */
export interface IFieldSchema {
  type?: "string" | "number" | "boolean" | "object" | "array" | "void";
  title?: string;
  description?: string;
  default?: any;
  order?: number;
  properties?: Record<string, IFieldSchema>;
  items?: IFieldSchema;

  display?: "visible" | "hidden" | "none";
  disabled?: boolean;
  component?: ComponentSpec;
  decorator?: ComponentSpec;
  options?: OptionItem[];

  "x-reactions"?: SchemaReaction[];
  "x-effect"?: SchemaRule;
  "x-format"?: { input?: SchemaRule; output?: SchemaRule };
  "x-validators"?: ValidatorRule[];
}

/** 表单 schema（根节点恒为 object）。 */
export interface IFormSchema {
  type: "object";
  properties?: Record<string, IFieldSchema>;
  "x-reactions"?: SchemaReaction[];
  "x-effect"?: SchemaRule;
}

/** rule 的四个命名空间，`@name` 按所在协议查对应表。 */
export type ReactionHandler = (ctx: RuntimeContext) => any;
export type EffectHandler = (ctx: RuntimeContext) => void | (() => void);
export type FormatHandler = (value: any, ctx: RuntimeContext) => any;
export type ValidatorHandler = (
  value: any,
  ctx: RuntimeContext,
) => true | string | Promise<true | string>;

/** 四命名空间注册表，恒复数。 */
export interface Handlers {
  reactions?: Record<string, ReactionHandler>;
  effects?: Record<string, EffectHandler>;
  formats?: Record<string, FormatHandler>;
  validators?: Record<string, ValidatorHandler>;
}

/** 字段种类。 */
export type FieldKind = "primitive" | "object" | "array" | "void";

/** 校验错误。 */
export interface FieldError {
  path: string;
  message: string;
}

/**
 * 从 schema 的 type 推导字段种类：object→object、array→array、void→void，其余为 primitive。
 */
export function kindOf(schema: IFieldSchema): FieldKind {
  switch (schema.type) {
    case "object":
      return "object";
    case "array":
      return "array";
    case "void":
      return "void";
    default:
      return "primitive";
  }
}

/**
 * 归一化 ComponentSpec 为 [key, props] 元组，便于统一存入 signal。
 */
export function normalizeComponent(
  spec: ComponentSpec | undefined,
): [string, Record<string, any> | undefined] {
  if (spec == null) return ["", undefined];
  return Array.isArray(spec) ? [spec[0], spec[1]] : [spec, undefined];
}
