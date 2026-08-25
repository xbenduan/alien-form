import { createContext, useContext } from "react";
import type { ModelRecord } from "../../../runtime/types";

export interface TableContextValue {
  selectedRowKeys: React.Key[];
  setSelectedRowKeys: (keys: React.Key[]) => void;
  onDelete: (id: string) => Promise<void>;
  onBatchDelete: (ids: string[]) => Promise<void>;
}

export const TableContext = createContext<TableContextValue | null>(null);

export function useTableContext(): TableContextValue {
  const ctx = useContext(TableContext);
  if (!ctx) throw new Error("[alien-mdm] useTableContext must be used within TableLayout");
  return ctx;
}

export const RowContext = createContext<ModelRecord | null>(null);

export function useRowRecord(): ModelRecord {
  const row = useContext(RowContext);
  if (!row) throw new Error("[alien-mdm] useRowRecord must be used within a table row");
  return row;
}
