import { z } from "zod";
import { backendDefinitionSchema, modelIdPattern } from "../model/schema";
import type { DataSchema, ViewNode } from "../model/types";

const metadata = {
  title: z.string().optional(),
  description: z.string().optional(),
  default: z.json().optional(),
  readOnly: z.boolean().optional(),
};
const length = z.number().int().nonnegative();
const dataSchema: z.ZodType<DataSchema> = z.lazy(() =>
  z.union([
    z.object({ ...metadata, $ref: z.string().regex(/^#\/\$defs\/[^/]*$/u) }).strict(),
    z
      .object({
        ...metadata,
        type: z.union([z.literal("string"), z.tuple([z.literal("string"), z.literal("null")])]),
        enum: z
          .array(z.union([z.string(), z.null()]))
          .nonempty()
          .optional(),
        minLength: length.optional(),
        maxLength: length.optional(),
        pattern: z.string().optional(),
      })
      .strict(),
    ...(["number", "integer"] as const).map((type) =>
      z
        .object({
          ...metadata,
          type: z.union([z.literal(type), z.tuple([z.literal(type), z.literal("null")])]),
          enum: z
            .array(z.union([type === "integer" ? z.number().int() : z.number(), z.null()]))
            .nonempty()
            .optional(),
          minimum: z.number().optional(),
          maximum: z.number().optional(),
        })
        .strict(),
    ),
    z
      .object({
        ...metadata,
        type: z.union([z.literal("boolean"), z.tuple([z.literal("boolean"), z.literal("null")])]),
        enum: z
          .array(z.union([z.boolean(), z.null()]))
          .nonempty()
          .optional(),
      })
      .strict(),
    z.object({ ...metadata, type: z.literal("null") }).strict(),
    objectDataSchema,
    z
      .object({
        ...metadata,
        type: z.literal("array"),
        items: dataSchema,
        minItems: length.optional(),
        maxItems: length.optional(),
      })
      .strict(),
  ]),
);
const objectDataSchema = z
  .object({
    ...metadata,
    type: z.literal("object"),
    properties: z.record(z.string(), dataSchema),
    required: z.array(z.string()).optional(),
    additionalProperties: z.literal(false).optional(),
  })
  .strict();
const expression = z
  .string()
  .regex(/^\s*\{\{[\s\S]+\}\}\s*$/u)
  .describe(
    "完整 JavaScript 表达式，例如 {{ $value === true }}；语法和引用由 models.validate 检查。",
  );
const bindings = z
  .object({
    value: expression
      .optional()
      .describe("把表达式的计算结果写入所绑定字段，例如 {{ $values.quantity * 10 }}。"),
    readOnly: z.union([z.boolean(), expression]).optional(),
    disabled: z.union([z.boolean(), expression]).optional(),
    visible: z.union([z.boolean(), expression]).optional(),
  })
  .strict();
const presentation = z
  .object({
    component: z
      .string()
      .min(1)
      .optional()
      .describe("从当前目标的有效 components 中选择；省略时按字段类型推导。"),
    props: z
      .record(z.string(), z.json())
      .optional()
      .describe("JSON props 或 {{ ... }} 表达式；受控属性只能通过 bindings 设置。"),
    bindings: bindings.optional(),
  })
  .strict();
const viewNode: z.ZodType<ViewNode> = z.lazy(() =>
  z.union([
    presentation
      .extend({
        component: z.string().min(1),
        field: z.string().optional(),
        children: z.array(viewNode).optional(),
      })
      .strict(),
    presentation
      .extend({
        field: z.string().describe("相对当前 scope 的 JSON Pointer；空串表示当前值。"),
        children: z.array(viewNode).optional(),
      })
      .strict(),
  ]),
);
const identity = z.string().regex(modelIdPattern);
const document = z
  .object({
    id: identity,
    domain: identity.optional(),
    title: z.string().regex(/\S/u),
    data: objectDataSchema.extend({ $defs: z.record(z.string(), dataSchema).optional() }).strict(),
    fields: z
      .record(
        z.string(),
        z
          .object({
            order: z
              .number()
              .int()
              .min(Number.MIN_SAFE_INTEGER)
              .max(Number.MAX_SAFE_INTEGER)
              .optional(),
            form: presentation.optional(),
            table: z
              .union([
                presentation.extend({ title: z.string().optional() }).strict(),
                z.literal(false),
              ])
              .optional(),
            filter: z.union([presentation, z.literal(false)]).optional(),
          })
          .strict(),
      )
      .optional()
      .describe("字段 Pointer 到展示配置的映射；数组项使用 *，例如 /addresses/*/city。"),
    tree: z.object({ parentField: z.string(), labelField: z.string() }).strict().optional(),
    views: z
      .record(z.string(), viewNode)
      .optional()
      .describe("键为已登记的 router 或 router/window；各目标 scope 由 Page/Window loader 决定。"),
    pages: z
      .record(
        identity,
        z
          .object({
            windows: z
              .record(
                identity,
                z
                  .object({
                    openMode: z.enum(["page", "drawer", "modal"]).optional(),
                  })
                  .strict(),
              )
              .optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

/** 提供完整 definition 的机器可读结构，跨字段及运行时约束仍由 models.validate 检查。 */
export const definitionJsonSchema = z.toJSONSchema(
  z.object({ document, backend: backendDefinitionSchema }).strict(),
  { io: "input" },
);
