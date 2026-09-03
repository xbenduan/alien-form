import type { CompiledExpression, IFormSchema } from "@alien-form/core";

/**
 * 协议类型统一出自 @alien-form/validate（前后端共享的 zod 单一真源）。
 * 本文件只保留前端编译产物类型（CompiledNode 等）与本地 JSON 值别名。
 */

export type {
  BuilderSchema,
  BuilderMeta as ModelMeta,
  FieldSchema,
  FieldGroup,
  XPage,
  DatabaseField,
  DatabaseRelation,
  DatabaseColumnType,
  DatabaseValueType,
  DatabaseRelationKind,
  OpenMode,
} from "@alien-form/validate";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface CompiledValue {
  readonly expression: CompiledExpression;
}

export interface CompiledNode {
  key: string;
  schema: import("@alien-form/validate").FieldSchema;
  props: Record<string, unknown>;
  slots: Record<string, CompiledNode | CompiledNode[]>;
  children: CompiledNode[];
}

export interface CompiledPage {
  router: string;
  title: string;
  schema: IFormSchema;
  nodes: CompiledNode[];
}
