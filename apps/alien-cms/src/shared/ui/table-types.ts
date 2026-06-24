import type * as React from "react";

export type SortOrder = "ascend" | "descend";
export type FilterValue = React.Key[] | boolean | null;

export interface TablePaginationConfig {
  current?: number;
  pageSize?: number;
  total?: number;
  showSizeChanger?: boolean;
  showTotal?: (total: number, range?: [number, number]) => React.ReactNode;
}

export interface SorterResult<T> {
  column?: ColumnType<T>;
  order?: SortOrder;
  field?: keyof T | string | Array<string | number>;
  columnKey?: React.Key;
}

export interface TableRowSelection<T> {
  selectedRowKeys?: React.Key[];
  onChange?: (selectedRowKeys: React.Key[], selectedRows: T[]) => void;
}

export interface ColumnType<T> {
  title?: React.ReactNode;
  key?: React.Key;
  dataIndex?: keyof T | string | Array<string | number>;
  width?: number | string;
  ellipsis?: boolean;
  sorter?: boolean;
  sortOrder?: SortOrder | null;
  fixed?: "left" | "right";
  render?: (value: unknown, record: T, index: number) => React.ReactNode;
}

export type ColumnsType<T> = ColumnType<T>[];
export type TableColumnsType<T> = ColumnType<T>[];

export interface TableLocale {
  emptyText?: React.ReactNode;
}

export interface TableProps<T> {
  rowKey?: string | ((record: T) => React.Key);
  columns?: ColumnsType<T>;
  dataSource?: T[];
  loading?: boolean;
  locale?: TableLocale;
  scroll?: {
    x?: number | string;
    y?: number | string;
  };
  pagination?: TablePaginationConfig | false;
  rowSelection?: TableRowSelection<T>;
  size?: "small" | "middle" | "large";
  onChange?: (
    pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<T> | SorterResult<T>[],
  ) => void;
}
