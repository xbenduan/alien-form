import { z } from "zod";
import type { IFieldSchema } from "./form-types.ts";

/**
 * IFieldSchema 的运行时校验。类型与校验均由 protocol 提供。
 */

const expressionSchema = z.string().regex(/^\s*\{\{[\s\S]*\}\}\s*$/, "必须是 {{...}} 表达式");

export const displaySchema = z.union([z.enum(["visible", "hidden", "none"]), expressionSchema]);

/** dataSource / props / x-* 等允许含表达式（{{...}}）与任意结构，运行时不深校验，只保证是合法 JSON 值。 */
const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
);

export const fieldSchema: z.ZodType = z.lazy(() =>
  z
    .object({
      type: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      default: jsonValue.optional(),
      properties: z.record(fieldSchema).optional(),
      items: z.union([fieldSchema, z.array(fieldSchema)]).optional(),
      $ref: z.string().optional(),
      order: z.number().optional(),
      required: z.union([z.boolean(), z.array(z.string())]).optional(),
      display: displaySchema.optional(),
      disabled: z.boolean().optional(),
      "x-layout": z.string().optional(),
      decorator: z.string().optional(),
      decoratorProps: z.record(jsonValue).optional(),
      component: z.string().optional(),
      props: z.record(jsonValue).optional(),
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

export interface FieldSchema extends Omit<IFieldSchema, "properties" | "items" | "display"> {
  display?: IFieldSchema["display"] | `{{${string}}}`;
  properties?: Record<string, FieldSchema>;
  items?: FieldSchema | FieldSchema[];
}
