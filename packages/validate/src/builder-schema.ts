import { z } from "zod";
import { fieldSchema, type FieldSchema } from "./field-schema.ts";

/** 物理列存储类型（映射到 SQLite）。 */
export const databaseColumnType = z.enum(["text", "integer", "real", "boolean", "json"]);
export type DatabaseColumnType = z.infer<typeof databaseColumnType>;

/** 应用层值类型。 */
export const databaseValueType = z.enum(["string", "number", "boolean", "object", "array"]);
export type DatabaseValueType = z.infer<typeof databaseValueType>;

export const databaseRelationKind = z.enum(["many-to-one", "many-to-many"]);
export type DatabaseRelationKind = z.infer<typeof databaseRelationKind>;

/** 打开方式：声明在触发按钮 props 上。 */
export const openMode = z.enum(["page", "modal", "drawer"]);
export type OpenMode = z.infer<typeof openMode>;

const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
const modelName = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export const databaseRelationSchema = z.object({
  kind: databaseRelationKind,
  target: z.string().regex(modelName, "relation.target 不合法"),
  through: z.string().regex(identifier).optional(),
  valueField: z.string().optional(),
  labelField: z.string().optional(),
});
export type DatabaseRelation = z.infer<typeof databaseRelationSchema>;

/** 物理表字段（存储真相源）。 */
export const databaseFieldSchema = z.object({
  key: z.string().regex(identifier, "字段名不合法"),
  title: z.string().optional(),
  column: z.string().regex(identifier, "column 不合法").optional(),
  type: databaseColumnType,
  valueType: databaseValueType.optional(),
  system: z.boolean().optional(),
  nullable: z.boolean().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  unique: z.boolean().optional(),
  index: z.boolean().optional(),
  visible: z.boolean().optional(),
  filterable: z.boolean().optional(),
  sortable: z.boolean().optional(),
  relation: databaseRelationSchema.optional(),
});
export type DatabaseField = z.infer<typeof databaseFieldSchema>;

export const builderMetaSchema = z
  .object({
    name: z.string().regex(modelName, "模型 meta.name 不合法"),
    title: z.string().min(1, "模型 meta.title 必填"),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    group: z.string().optional(),
    singularLabel: z.string().optional(),
    pluralLabel: z.string().optional(),
    defaultPageSize: z.number().optional(),
  })
  .passthrough();
export type BuilderMeta = z.infer<typeof builderMetaSchema>;

/** 页面装配。 */
export const xPageSchema = z.object({
  router: z.string(),
  title: z.string().optional(),
  layout: z
    .object({ component: z.string(), props: z.record(z.unknown()).optional() })
    .optional(),
  properties: z.record(fieldSchema),
});
export type XPage = z.infer<typeof xPageSchema>;

export const builderSchemaSchema = z
  .object({
    meta: builderMetaSchema,
    fields: z.array(databaseFieldSchema),
    definitions: z
      .object({ "form-schema": fieldSchema })
      .catchall(fieldSchema),
    pages: z.array(xPageSchema),
  })
  .passthrough();

/**
 * BuilderSchema —— 与 canonical schema.tsx 契约一致的顶层模型协议。
 * 前后端共享；类型由 zod 推断但 FieldSchema/pages 用手写接口以获得递归精度。
 */
export interface BuilderSchema {
  meta: BuilderMeta;
  fields: DatabaseField[];
  definitions: {
    "form-schema": FieldSchema;
    [key: string]: FieldSchema;
  };
  pages: XPage[];
}
