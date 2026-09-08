import { z } from "zod";
import { fieldSchema, type FieldSchema } from "./field-schema.ts";

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const modelNamePattern = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export const databaseColumnTypeSchema = z.enum([
  "text",
  "integer",
  "real",
  "boolean",
  "date",
  "json",
]);
export type DatabaseColumnType = z.infer<typeof databaseColumnTypeSchema>;

export const databaseValueTypeSchema = z.enum(["string", "number", "boolean", "object", "array"]);
export type DatabaseValueType = z.infer<typeof databaseValueTypeSchema>;

export const databaseRelationKindSchema = z.enum(["many-to-one", "many-to-many"]);
export type DatabaseRelationKind = z.infer<typeof databaseRelationKindSchema>;

export const openModeSchema = z.enum(["page", "modal", "drawer"]);
export type OpenMode = z.infer<typeof openModeSchema>;

export const databaseRelationSchema = z.object({
  kind: databaseRelationKindSchema,
  target: z.string().regex(modelNamePattern, "relation.target 不合法"),
  through: z.string().regex(identifierPattern, "relation.through 不合法").optional(),
  valueField: z.string().regex(identifierPattern, "relation.valueField 不合法").optional(),
  labelField: z.string().regex(identifierPattern, "relation.labelField 不合法").optional(),
});
export type DatabaseRelation = z.infer<typeof databaseRelationSchema>;

export const modelFieldDatabaseSchema = z.object({
  type: databaseColumnTypeSchema,
  valueType: databaseValueTypeSchema.optional(),
  column: z.string().regex(identifierPattern, "database.column 不合法").optional(),
  system: z.boolean().optional(),
  nullable: z.boolean().optional(),
  default: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  unique: z.boolean().optional(),
  index: z.boolean().optional(),
});
export type ModelFieldDatabase = z.infer<typeof modelFieldDatabaseSchema>;

export const modelFieldSchema = z.object({
  id: z.string().min(1, "字段 id 必填"),
  key: z.string().regex(identifierPattern, "字段 key 不合法"),
  storage: z.enum(["physical", "virtual"]),
  database: modelFieldDatabaseSchema.optional(),
  relation: databaseRelationSchema.optional(),
  form: fieldSchema,
  table: z
    .object({
      title: z.string().optional(),
      hidden: z.boolean().optional(),
    })
    .optional(),
  filter: z
    .object({
      hidden: z.boolean().optional(),
    })
    .optional(),
});

export interface ModelFieldSchema {
  id: string;
  key: string;
  storage: "physical" | "virtual";
  database?: ModelFieldDatabase;
  relation?: DatabaseRelation;
  form: FieldSchema;
  table?: {
    title?: string;
    hidden?: boolean;
  };
  filter?: {
    hidden?: boolean;
  };
}

export const fieldGroupSchema = z.object({
  component: z.string().optional(),
  keys: z.array(z.string().regex(identifierPattern, "group key 不合法")),
  title: z.string().optional(),
  description: z.string().optional(),
  props: z.record(z.unknown()).optional(),
});
export type FieldGroup = z.infer<typeof fieldGroupSchema>;

export const pageSchema = z.object({
  router: z.string().min(1, "页面 router 必填"),
  title: z.string().optional(),
  layout: z
    .object({
      component: z.string(),
      props: z.record(z.unknown()).optional(),
    })
    .optional(),
  groups: z.array(fieldGroupSchema).optional(),
  properties: z.record(fieldSchema),
});
export type PageSchema = z.infer<typeof pageSchema>;

export const modelSchemaSchema = z.object({
  name: z.string().regex(modelNamePattern, "模型 name 不合法"),
  title: z.string().min(1, "模型 title 必填"),
  version: z.number().int().nonnegative(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  group: z.string().optional(),
  singularLabel: z.string().optional(),
  pluralLabel: z.string().optional(),
  defaultPageSize: z.number().int().positive().optional(),
  fields: z.array(modelFieldSchema).min(1, "fields 不能为空"),
  definitions: z.record(fieldSchema).optional(),
  pages: z.array(pageSchema),
});

export interface ModelSchema {
  name: string;
  title: string;
  version: number;
  subtitle?: string;
  description?: string;
  group?: string;
  singularLabel?: string;
  pluralLabel?: string;
  defaultPageSize?: number;
  fields: ModelFieldSchema[];
  definitions?: Record<string, FieldSchema>;
  pages: PageSchema[];
}

export interface ModelSummary {
  name: string;
  title: string;
  version: number;
  subtitle?: string;
  description?: string;
  group?: string;
  singularLabel?: string;
  pluralLabel?: string;
  defaultPageSize?: number;
  fieldCount: number;
  updatedAt: string;
}

export const modelSummarySchema: z.ZodType<ModelSummary> = z.object({
  name: z.string().regex(modelNamePattern),
  title: z.string(),
  version: z.number().int().positive(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  group: z.string().optional(),
  singularLabel: z.string().optional(),
  pluralLabel: z.string().optional(),
  defaultPageSize: z.number().int().positive().optional(),
  fieldCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
});

export function parseModelSummaries(value: unknown): ModelSummary[] {
  return z.array(modelSummarySchema).parse(value);
}
