import type { DataSourceItem } from "@alien-form/react";
import type { ModelFieldSchema, ModelSchema } from "../../../services";

export type DataSourceMap = Record<string, DataSourceItem[]>;

/**
 * 把已解析的联动数据源注入 schema 顶层字段的 dataSource。
 * table 场景无表单不会运行 x-reaction，因此需要预先注入以翻译外键标签。
 */
export function applyDataSources(schema: ModelSchema, map: DataSourceMap): ModelSchema {
  if (Object.keys(map).length === 0) return schema;

  const properties = Object.fromEntries(
    Object.entries(schema.properties).map(([key, field]) => {
      const resolved = map[key];
      if (!resolved) return [key, field];
      return [key, { ...field, dataSource: resolved } as ModelFieldSchema];
    }),
  );

  return { ...schema, properties };
}
