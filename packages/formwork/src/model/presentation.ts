import { FormworkError } from "./errors";
import { escapePointer, pointerSegments } from "./pointer";
import { resolveSchema } from "./validation";
import type { DataSchema, RuntimeFieldDefinition, RuntimeFieldPresentation } from "./types";

/** 标识共享 Render 使用的字段展示场景。 */
export type FieldMode = "form" | "table" | "filter";

/** 定位可复用字段配置，将数组索引规范化为星号通配符。 */
export function schemaFieldAt(
  root: DataSchema,
  pointer: string,
): { schema: DataSchema; path: string } {
  let schema = resolveSchema(root, root);
  const path: string[] = [];
  for (const part of pointerSegments(pointer)) {
    if ("properties" in schema && Object.hasOwn(schema.properties, part)) {
      path.push(escapePointer(part));
      schema = resolveSchema(schema.properties[part]!, root);
    } else if ("items" in schema && (part === "*" || /^(0|[1-9]\d*)$/u.test(part))) {
      path.push("*");
      schema = resolveSchema(schema.items, root);
    } else {
      throw new FormworkError("UNKNOWN_FIELD", `字段配置不存在 ${pointer}`);
    }
  }
  return { schema, path: path.length ? `/${path.join("/")}` : "" };
}

/** 选择字段在当前场景的覆盖，未配置或被隐藏时返回空展示配置。 */
export function fieldPresentation(
  fields: Readonly<Record<string, RuntimeFieldDefinition>> | undefined,
  root: DataSchema,
  pointer: string,
  mode: FieldMode,
): RuntimeFieldPresentation {
  if (!fields) return {};
  let definition: RuntimeFieldDefinition | undefined;
  try {
    definition = fields[schemaFieldAt(root, pointer).path];
  } catch (error) {
    // 独立查询 scope 可以定义模型以外的字段，此时不继承模型展示。
    if (!(error instanceof FormworkError) || error.code !== "UNKNOWN_FIELD") throw error;
  }
  return definition?.[mode] || {};
}

/** 按字段 order 和原 properties 顺序稳定排列当前对象的字段。 */
export function orderedProperties(
  schema: DataSchema,
  root: DataSchema,
  fields?: Readonly<Record<string, RuntimeFieldDefinition>>,
  pointer = "",
): Array<[string, DataSchema]> {
  schema = resolveSchema(schema, root);
  if (!("properties" in schema)) return [];
  if (fields && pointer) {
    try {
      pointer = schemaFieldAt(root, pointer).path;
    } catch (error) {
      if (!(error instanceof FormworkError) || error.code !== "UNKNOWN_FIELD") throw error;
      fields = undefined;
    }
  }
  return Object.entries(schema.properties).sort(
    ([a], [b]) =>
      (fields?.[`${pointer}/${escapePointer(a)}`]?.order ?? 0) -
      (fields?.[`${pointer}/${escapePointer(b)}`]?.order ?? 0),
  );
}
