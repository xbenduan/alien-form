import type { FilterForm } from "@alien-form/shared";
import type { AfUiNode, ModelRecord, PageContext, Pagination, Sorter } from "../../../runtime";

export interface PageState {
  compiled?: { filter: Parameters<typeof FilterForm>[0]["filterSchema"]; columns: never[] };
  records: ModelRecord[];
  total: number;
  listLoading: boolean;
  deleting: boolean;
  pagination: Pagination;
  setFilters: (values: Record<string, unknown>) => void;
  setLayoutFilters: (values: Record<string, unknown>) => void;
  setPagination: (value: Pagination) => void;
  setSorter: (value?: Sorter) => void;
  refresh: () => void;
  openAdd: () => void;
  openEdit: (id: string) => void;
  openDetail: (id: string) => void;
  removeRecord: (id: string) => Promise<unknown>;
  removeRecords: (ids: string[]) => Promise<unknown>;
}

export interface TableContext {
  selectedRowKeys: React.Key[];
  setSelectedRowKeys: (keys: React.Key[]) => void;
  row?: ModelRecord;
}

export type LayoutContext = PageContext & { table?: TableContext };

export function pageOf(ctx: PageContext): PageState {
  return ctx.page as PageState;
}

export function layoutCtx(ctx: PageContext, table?: TableContext): LayoutContext {
  return table ? { ...ctx, table } : (ctx as LayoutContext);
}

export type UiNodeProps = {
  children: AfUiNode[];
  ctx: PageContext;
};
