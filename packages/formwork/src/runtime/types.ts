import type { Accessor, Component, JSX } from "solid-js";
import type {
  DataSchema,
  JsonValue,
  RecordValue,
  Scene,
  QueryOperator,
  ValidationIssue,
} from "../model/types";
import type { FieldDescriptor } from "../model/field";

/** 注册 app.ui 和字段 Schema 可以引用的 Solid 组件。 */
export type ComponentRegistry = Record<string, Component<any>>;
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
  field: (pointer: string) => ValueBinding;
};
/** 将响应式记录值接入 renderer，不在字段描述中保存状态。 */
export type ValueBinding = {
  kind: "value";
  path: Accessor<string>;
  value: Accessor<JsonValue | undefined>;
  set: (value: JsonValue | undefined) => void;
  errors: Accessor<readonly ValidationIssue[]>;
  readOnly: Accessor<boolean>;
  scope: ValueScope;
};
/** 保存独立查询状态，active 与 null operand 分开表示。 */
export type FilterBinding = {
  kind: "filter";
  path: Accessor<string>;
  active: Accessor<boolean>;
  setActive: (active: boolean) => void;
  operator: Accessor<QueryOperator>;
  setOperator: (operator: QueryOperator) => void;
  operandSchema: Accessor<DataSchema | undefined>;
  value: Accessor<JsonValue | undefined>;
  set: (value: JsonValue | undefined) => void;
  errors: Accessor<readonly ValidationIssue[]>;
  readOnly: Accessor<boolean>;
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
/** 提供字段标签、错误及可选值绑定，供 app 实现删除值或设置 null。 */
export type FieldContainerProps = ContainerProps & {
  path: string;
  title: string;
  schema?: DataSchema;
  required: boolean;
  errors: readonly ValidationIssue[];
  field?: FieldDescriptor;
  scene?: Scene;
  binding?: ValueBinding;
  disabled?: boolean;
  readOnly?: boolean;
};
/** 为值组件提供响应式受控属性，onChange 始终执行写入限制。 */
export type FieldProps = ContainerProps & {
  field: FieldDescriptor;
  scene: Scene;
  value: JsonValue | undefined;
  onChange: (value: JsonValue | undefined) => void;
  readOnly: boolean;
  disabled: boolean;
  errors: readonly ValidationIssue[];
  schema: DataSchema;
  options: readonly import("../model/types").EnumOption[];
  multiple: boolean;
  relation?: import("../model/types").FieldRelation;
  operator?: QueryOperator;
  operandSchema?: DataSchema;
  record?: RecordValue;
  Detail?: Component;
  array?: ArrayHandle;
  Item?: Component<{ scope: ValueScope }>;
  ValueItem?: Component<{ value: JsonValue }>;
};
/** 为内部字段遍历提供可覆盖的展示配置。 */
export type RenderProps = {
  mode?: Scene;
  scene?: Scene;
  field?: string;
  scope?: ValueScope;
  container?: Component<ContainerProps>;
  fieldContainer?: Component<FieldContainerProps>;
  components?: ComponentRegistry;
};
/** 绑定一个无状态字段描述，或直接展示当前记录的值。 */
export type RenderItemProps = {
  field: FieldDescriptor;
  scene: Scene;
  component?: string;
  props?: Record<string, unknown>;
  record?: RecordValue;
  readOnly?: boolean;
  disabled?: boolean;
} & (
  | { binding: ValueBinding | FilterBinding; value?: never }
  | { value?: JsonValue; binding?: never }
);
