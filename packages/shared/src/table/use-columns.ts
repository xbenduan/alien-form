import { useMemo } from "react";
import type { SchemaConfig, TableColumn } from "../types";
import { buildTableColumns } from "../utils/transform";

/**
 * useColumns：从配置态 schema 顶层字段产出 table 列定义。
 * 复杂字段（object/array）标记 complex，单元格折叠为摘要 + 详情按钮。
 */
export function useColumns(config: SchemaConfig): TableColumn[] {
  return useMemo(() => buildTableColumns(config), [config]);
}
