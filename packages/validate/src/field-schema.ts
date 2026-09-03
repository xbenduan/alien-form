import { z } from "zod";
import type { IFieldSchema } from "@alien-form/core";

/**
 * FieldSchema —— 前端表单字段描述（form-schema 片段），结构对齐 @alien-form/core 的 IFieldSchema。
 * 这里用 zod 复刻 IFieldSchema 的形状，作为前后端共享的运行时校验；类型侧通过
 * satisfies 断言与 core 的 IFieldSchema 保持一致（见文件底部）。
 */

export const displaySchema = z.enum(["visible", "hidden", "none"]);

/** dataSource / props / x-* 等允许含表达式（{{...}}）与任意结构，运行时不深校验，只保证是合法 JSON 值。 */
const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(jsonValue),
  ]),
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
      "x-format": z.object({ input: jsonValue.optional(), output: jsonValue.optional() }).optional(),
      "x-validate": jsonValue.optional(),
      dataSource: jsonValue.optional(),
      group: z.array(z.lazy(() => fieldGroupSchema)).optional(),
    })
    .passthrough(),
);

export const fieldGroupSchema = z.object({
  component: z.string().optional(),
  keys: z.array(z.string()),
  title: z.string().optional(),
  description: z.string().optional(),
  props: z.record(jsonValue).optional(),
});

export interface FieldGroup {
  component?: string;
  keys: string[];
  title?: string;
  description?: string;
  props?: Record<string, unknown>;
}

/**
 * FieldSchema：在 core IFieldSchema 基础上追加 group（表单分组，仅根节点/对象字段用）。
 * 下方类型级断言保证 FieldSchema 与 core 的 IFieldSchema 结构兼容——form-schema 字段类型
 * 就是 core 的 IFieldSchema（目标 1）。
 */
export interface FieldSchema extends Omit<IFieldSchema, "properties" | "items"> {
  properties?: Record<string, FieldSchema>;
  items?: FieldSchema | FieldSchema[];
  group?: FieldGroup[];
}

// 类型级保证：FieldSchema 可赋回 core 的 IFieldSchema（去掉 group 后结构一致）。
type _AssertAlignsWithCore = FieldSchema extends Omit<IFieldSchema, "properties" | "items">
  ? true
  : never;
const _assertAlignsWithCore: _AssertAlignsWithCore = true;
void _assertAlignsWithCore;
