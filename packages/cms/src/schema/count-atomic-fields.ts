import type { CmsFieldSchema, CmsModelSchema } from "../types/schema";

/**
 * 递归统计 schema 中的原子（叶子）字段数量。
 * - primitive 字段（string/number/boolean/tags 等非 object/array/void）计 1。
 * - object/void：递归统计其 properties 下的叶子字段。
 * - array：递归统计其 items.properties 下的叶子字段（item 为 object 时）；若 items 为原子类型，array 本身计 1。
 */
export function countAtomicFields(
  schema: CmsModelSchema | CmsFieldSchema | undefined,
): number {
  if (!schema?.properties) return 0;

  let count = 0;
  for (const field of Object.values(schema.properties)) {
    count += countField(field);
  }
  return count;
}

function countField(field: CmsFieldSchema): number {
  const type = field.type;

  if ((type === "object" || type === "void") && field.properties) {
    return countAtomicFields(field);
  }

  if (type === "array") {
    const items = field.items;
    if (
      items &&
      !Array.isArray(items) &&
      items.type === "object" &&
      items.properties
    ) {
      return countAtomicFields(items as CmsFieldSchema);
    }
    return 1;
  }

  return 1;
}
