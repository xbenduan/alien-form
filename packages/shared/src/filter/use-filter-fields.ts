import { useMemo } from "react";
import type { IFormSchema } from "@alien-form/react";
import type { LeafField, SchemaConfig } from "../types";
import { collectLeafFields } from "../utils/schema";
import { buildFilterSchema } from "../utils/transform";

export interface FilterFields {
  schema: IFormSchema;
  leaves: LeafField[];
}

/**
 * useFilterFields：递归整棵 schema 树取所有叶子字段，产出 filter schema。
 * 不含校验、默认值、必填。leaves 与 filter schema 保持一致：
 * 只保留实际渲染到筛选区的字段（跳过 display==="none" / x-filter.visible===false）。
 */
export function useFilterFields(config: SchemaConfig): FilterFields {
  return useMemo(() => {
    const schema = buildFilterSchema(config);
    const visibleKeys = new Set(Object.keys(schema.properties ?? {}));
    const leaves = collectLeafFields(config.properties).filter(({ key }) => visibleKeys.has(key));
    return { schema, leaves };
  }, [config]);
}
