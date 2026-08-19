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
 * 不含校验、默认值、必填。
 */
export function useFilterFields(config: SchemaConfig): FilterFields {
  return useMemo(
    () => ({
      schema: buildFilterSchema(config),
      leaves: collectLeafFields(config.properties),
    }),
    [config],
  );
}
