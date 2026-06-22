import { useCallback, useMemo, useState } from "react";
import type { Dispatch, Key, SetStateAction } from "react";
import type {
  FilterValue,
  SorterResult,
  TablePaginationConfig,
} from "antd/es/table/interface";

export interface TableSorter {
  field?: string;
  order?: "ascend" | "descend";
}

export interface TablePaginationState {
  current: number;
  pageSize: number;
}

export interface UseTableOptions<T> {
  defaultPageSize?: number;
  defaultCurrent?: number;
  rowKey?: string | ((row: T) => string);
  enableRowSelection?: boolean;
  defaultSorter?: TableSorter;
}

export interface TableRowSelectionConfig {
  selectedRowKeys: Key[];
  onChange: (keys: Key[]) => void;
}

export interface UseTableProps<T> {
  rowKey: string | ((row: T) => string);
  pagination: TablePaginationState;
  rowSelection?: TableRowSelectionConfig;
  onChange: (
    nextPagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    nextSorter: SorterResult<T> | SorterResult<T>[],
  ) => void;
}

export interface UseTableResult<T> {
  pagination: TablePaginationState;
  sorter?: TableSorter;
  selectedRowKeys: Key[];
  setPagination: Dispatch<SetStateAction<TablePaginationState>>;
  setSorter: Dispatch<SetStateAction<TableSorter | undefined>>;
  setSelectedRowKeys: Dispatch<SetStateAction<Key[]>>;
  resetPagination: () => void;
  clearSelection: () => void;
  tableProps: UseTableProps<T>;
}

export function useTable<T>(options: UseTableOptions<T> = {}): UseTableResult<T> {
  const {
    defaultPageSize = 10,
    defaultCurrent = 1,
    rowKey = "id",
    enableRowSelection = false,
    defaultSorter,
  } = options;

  const [pagination, setPagination] = useState<TablePaginationState>({
    current: defaultCurrent,
    pageSize: defaultPageSize,
  });
  const [sorter, setSorter] = useState<TableSorter | undefined>(defaultSorter);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  const resetPagination = useCallback(() => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRowKeys([]);
  }, []);

  const handleChange = useCallback(
    (
      nextPagination: TablePaginationConfig,
      _filters: Record<string, FilterValue | null>,
      nextSorter: SorterResult<T> | SorterResult<T>[],
    ) => {
      setPagination({
        current: nextPagination.current ?? 1,
        pageSize: nextPagination.pageSize ?? defaultPageSize,
      });
      // antd 单列排序时返回对象，多列排序返回数组，这里只取首项
      const single = Array.isArray(nextSorter) ? nextSorter[0] : nextSorter;
      if (!single || !single.order || !single.field) {
        setSorter(undefined);
        return;
      }
      const field = Array.isArray(single.field) ? single.field.join(".") : String(single.field);
      setSorter({ field, order: single.order });
    },
    [defaultPageSize],
  );

  const tableProps = useMemo<UseTableProps<T>>(
    () => ({
      rowKey,
      pagination,
      rowSelection: enableRowSelection
        ? { selectedRowKeys, onChange: setSelectedRowKeys }
        : undefined,
      onChange: handleChange,
    }),
    [rowKey, pagination, enableRowSelection, selectedRowKeys, handleChange],
  );

  return {
    pagination,
    sorter,
    selectedRowKeys,
    setPagination,
    setSorter,
    setSelectedRowKeys,
    resetPagination,
    clearSelection,
    tableProps,
  };
}
