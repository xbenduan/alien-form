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
/** 保存完整业务描述，版本与源位置由 ModelSnapshot 承载。 */
export type ModelDocument = {
  id: string;
  title: string;
  data: ObjectSchema & SchemaMetadata & { $defs?: Record<string, DataSchema> };
  views?: Record<string, ViewNode>;
};
/** 定位模型的原始完整管理源。 */
export type ModelLocation = { kind: "local"; path: string } | { kind: "remote"; uri: string };
/** 提供模型目录中可以比较的不透明版本。 */
export type ModelEntry = {
  id: string;
  title: string;
  revision: string;
  location: ModelLocation;
  writable: boolean;
};
/** 返回某一版本的完整模型，权限投影不满足此契约。 */
export type ModelSnapshot = ModelEntry & { document: ModelDocument; completeness: "full" };
/** 允许取消提交前的读取或写入准备。 */
export type ReadOptions = { signal?: AbortSignal };
/** 条件替换完整模型；ifRevision:null 只允许创建。 */
export type WriteOptions = ReadOptions & { ifRevision: string | null };
/** 为目录、完整读取和条件写入提供同一个 Adapter 契约。 */
export type ModelSource = {
  list: (options?: ReadOptions) => Promise<readonly ModelEntry[]>;
  read: (modelId: string, options?: ReadOptions) => Promise<ModelSnapshot>;
  write: (document: ModelDocument, options: WriteOptions) => Promise<ModelSnapshot>;
};
/** 定位 scope 值或模型配置中的问题。 */
export type ValidationIssue = { path: string; code: string; message: string };
/** 为工具诊断补充模型、路由与源码位置。 */
export type Diagnostic = ValidationIssue & {
  modelId?: string;
  router?: string;
  source?: { file: string; line: number; column: number };
};
