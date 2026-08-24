import type { UIComponentDescribe } from "../../../runtime";
import { ActionAdd, ActionBatchDelete, ActionRefresh, RowActions, RowDelete, RowDetail, RowEdit } from "./actions";
import { Filter } from "./filter";
import { TreeLayout } from "./layout";
import { Page } from "./page";
import { TableLayout } from "./table";
import { TreePanel } from "./tree";

export const globalUI: Record<string, UIComponentDescribe> = {
  page: { Component: Page },
  treelayout: { Component: TreeLayout },
  filter: { Component: Filter },
  table: { Component: TableLayout },
  tree: { Component: TreePanel },
  "action-add": { Component: ActionAdd },
  "action-refresh": { Component: ActionRefresh },
  "action-batch-delete": { Component: ActionBatchDelete },
  "row-actions": { Component: RowActions },
  detail: { Component: RowDetail },
  edit: { Component: RowEdit },
  delete: { Component: RowDelete },
};
