import { z } from "zod";

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const modelNamePattern = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const expressionSchema = z
  .string()
  .regex(/^\s*\{\{[\s\S]*\}\}\s*$/, "必须是 {{...}} 表达式") as z.ZodType<`{{${string}}}`>;
const jsonValue: z.ZodType<any> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
);
const databaseColumnTypeSchema = z.enum(["text", "integer", "real", "boolean", "date", "json"]);
const fieldValueTypeSchema = z.enum(["string", "number", "boolean", "object", "array"]);
const relationKindSchema = z.enum(["many-to-one", "many-to-many"]);
const permissionSchema = z.enum(["read", "create", "update", "delete"]);

export type AlienValue =
  | string
  | number
  | boolean
  | null
  | AlienValue[]
  | { [key: string]: AlienValue };

/** Recursive AST node shared by forms, definitions, pages, properties, items, and slots. */
export interface AlienFieldSchema {
  type?: string;
  title?: string;
  description?: string;
  default?: AlienValue;
  properties?: Record<string, AlienFieldSchema>;
  items?: AlienFieldSchema | AlienFieldSchema[];
  $ref?: string;
  order?: number;
  required?: boolean | string[];
  display?: "visible" | "hidden" | "none" | `{{${string}}}`;
  disabled?: boolean;
  decorator?: string;
  decoratorProps?: Record<string, AlienValue>;
  component?: string;
  props?: Record<string, AlienValue>;
  slots?: Record<string, Record<string, AlienFieldSchema>>;
  permission?: "read" | "create" | "update" | "delete";
  "x-reaction"?: Record<string, AlienValue>;
  "x-effect"?: AlienValue;
  "x-format"?: {
    input?: AlienValue;
    output?: AlienValue;
  };
  "x-validate"?: AlienValue;
  dataSource?: AlienValue;
}

/**
 * Complete persisted Alien model protocol.
 *
 * All non-recursive subtypes must be addressed from this root, for example:
 * `AlienSchema["fields"][number]` and `AlienSchema["pages"][number]`.
 */
export interface AlienSchema {
  name: string;
  title: string;
  version: number;
  system?: boolean;
  systemRevision?: number;
  creatorId?: string;
  subtitle?: string;
  description?: string;
  group?: string;
  singularLabel?: string;
  pluralLabel?: string;
  defaultPageSize?: number;
  fields: Array<{
    id: string;
    key: string;
    type: "string" | "number" | "boolean" | "object" | "array" | "void";
    title?: string;
    required?: boolean;
    /** 仅供服务端内部使用，不得出现在公开 Schema 或记录响应中。 */
    private?: boolean;
    storage?: {
      type: "text" | "integer" | "real" | "boolean" | "date" | "json";
      column?: string;
      system?: boolean;
      default?: string | number | boolean | null;
      unique?: boolean;
      index?: boolean;
    };
    relation?: {
      kind: "many-to-one" | "many-to-many";
      target: string;
      through?: string;
      valueField?: string;
      labelField?: string;
    };
    form: AlienFieldSchema;
    table?: {
      title?: string;
      hidden?: boolean;
    };
    filter?: {
      hidden?: boolean;
    };
  }>;
  form: AlienFieldSchema;
  definitions?: Record<string, AlienFieldSchema>;
  pages: Array<
    AlienFieldSchema & {
      router: string;
      title?: string;
      permission: "read" | "create" | "update" | "delete";
      type: "void";
    }
  >;
}

/** Runtime validator for every recursive AST node in AlienSchema. */
export const alienFieldSchema: z.ZodType<AlienFieldSchema> = z.lazy(() =>
  z
    .object({
      type: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      default: jsonValue.optional(),
      properties: z.record(alienFieldSchema).optional(),
      items: z.union([alienFieldSchema, z.array(alienFieldSchema)]).optional(),
      $ref: z.string().optional(),
      order: z.number().optional(),
      required: z.union([z.boolean(), z.array(z.string())]).optional(),
      display: z.union([z.enum(["visible", "hidden", "none"]), expressionSchema]).optional(),
      disabled: z.boolean().optional(),
      decorator: z.string().optional(),
      decoratorProps: z.record(jsonValue).optional(),
      component: z.string().optional(),
      props: z.record(jsonValue).optional(),
      slots: z.record(z.record(alienFieldSchema)).optional(),
      permission: permissionSchema.optional(),
      "x-reaction": z.record(jsonValue).optional(),
      "x-effect": jsonValue.optional(),
      "x-format": z
        .object({ input: jsonValue.optional(), output: jsonValue.optional() })
        .optional(),
      "x-validate": jsonValue.optional(),
      dataSource: jsonValue.optional(),
    })
    .passthrough(),
);

const relationSchema: z.ZodType<NonNullable<AlienSchema["fields"][number]["relation"]>> = z.object({
  kind: relationKindSchema,
  target: z.string().regex(modelNamePattern, "relation.target 不合法"),
  through: z.string().regex(identifierPattern, "relation.through 不合法").optional(),
  valueField: z.string().regex(identifierPattern, "relation.valueField 不合法").optional(),
  labelField: z.string().regex(identifierPattern, "relation.labelField 不合法").optional(),
});

const storageSchema: z.ZodType<NonNullable<AlienSchema["fields"][number]["storage"]>> = z.object({
  type: databaseColumnTypeSchema,
  column: z.string().regex(identifierPattern, "storage.column 不合法").optional(),
  system: z.boolean().optional(),
  default: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  unique: z.boolean().optional(),
  index: z.boolean().optional(),
});

const alienModelFieldSchema: z.ZodType<AlienSchema["fields"][number]> = z.object({
  id: z.string().min(1, "字段 id 必填"),
  key: z.string().regex(identifierPattern, "字段 key 不合法"),
  type: fieldValueTypeSchema.or(z.literal("void")),
  title: z.string().optional(),
  required: z.boolean().optional(),
  private: z.boolean().optional(),
  storage: storageSchema.optional(),
  relation: relationSchema.optional(),
  form: alienFieldSchema,
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

export const alienPageSchema: z.ZodType<AlienSchema["pages"][number]> = alienFieldSchema.and(
  z.object({
    router: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "页面 router 必须是单个合法路径段"),
    title: z.string().optional(),
    permission: permissionSchema,
    type: z.literal("void"),
  }),
);

/** Runtime validator and machine-readable source for the complete persisted protocol. */
export const alienSchema: z.ZodType<AlienSchema> = z.object({
  name: z.string().regex(modelNamePattern, "模型 name 不合法"),
  title: z.string().min(1, "模型 title 必填"),
  version: z.number().int().nonnegative(),
  system: z.boolean().optional(),
  systemRevision: z.number().int().nonnegative().optional(),
  creatorId: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  group: z.string().optional(),
  singularLabel: z.string().optional(),
  pluralLabel: z.string().optional(),
  defaultPageSize: z.number().int().positive().optional(),
  fields: z.array(alienModelFieldSchema).min(1, "fields 不能为空"),
  form: alienFieldSchema,
  definitions: z.record(alienFieldSchema).optional(),
  pages: z.array(alienPageSchema),
});
