/** 运行时数据类型：记录、分页、排序、插件标记。前后端共享。 */

export interface ModelRecord {
  id: string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface Pagination {
  current: number;
  pageSize: number;
}

export interface Sorter {
  field: string;
  order: "ascend" | "descend";
}

/** 静态选项项。 */
export interface DataSourceItem {
  label: string;
  value: unknown;
}

/** 通用插件 marker（后端只透传，不解释）。 */
export interface PluginMarker {
  plugin: string;
  [key: string]: unknown;
}

export function isPluginMarker(value: unknown): value is PluginMarker {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { plugin?: unknown }).plugin === "string"
  );
}
