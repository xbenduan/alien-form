import type { AfUiNode, ModelRecord, PageContext, Pagination, Sorter } from "../../../runtime";

/**
 * 页面协调器：只承载跨组件的动作协调（打开 add/edit/detail 叠加层或路由跳转）。
 * 数据获取已下沉到各组件按 props.services 语义 key 自取，不再经过此对象。
 */
export interface PageCoordinator {
  openAdd: () => void;
  openEdit: (id: string) => void;
  openDetail: (id: string) => void;
}

export interface TableContext {
  selectedRowKeys: React.Key[];
  setSelectedRowKeys: (keys: React.Key[]) => void;
  row?: ModelRecord;
}

export type LayoutContext = PageContext & { table?: TableContext };

export function pageOf(ctx: PageContext): PageCoordinator {
  return ctx.page as PageCoordinator;
}

export function layoutCtx(ctx: PageContext, table?: TableContext): LayoutContext {
  return table ? { ...ctx, table } : (ctx as LayoutContext);
}

export type UiNodeProps = {
  props: Record<string, unknown>;
  children: AfUiNode[];
  ctx: PageContext;
};

export function scopeOf(ctx: PageContext) {
  if (!ctx.scope) throw new Error("[alien-cms] PageContext 缺少 DataScope");
  return ctx.scope;
}

export type { Pagination, Sorter };
