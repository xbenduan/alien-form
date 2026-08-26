import type { Runtime } from "@alien-form/engine";
import { Layout } from "./layout";
import { Filter } from "./filter";
import { TableLayout } from "./table";
import { TreePanel } from "./tree";
import {
  ActionAdd,
  ActionRefresh,
  ActionBatchDelete,
  RowActions,
  RowDelete,
  RowDetail,
  RowEdit,
} from "./actions";

export function registerUIComponents(runtime: Runtime): void {
  runtime.component("layout", {
    component: Layout,
    slots: ["left", "rightTop", "rightBottom"],
  });
  runtime.component("filter", { component: Filter });
  runtime.component("table", { component: TableLayout, slots: ["toolbarLeft", "toolbarRight"] });
  runtime.component("tree", { component: TreePanel });
  runtime.component("action-add", { component: ActionAdd });
  runtime.component("action-refresh", { component: ActionRefresh });
  runtime.component("action-batch-delete", { component: ActionBatchDelete });
  runtime.component("row-actions", { component: RowActions });
  runtime.component("detail", { component: RowDetail });
  runtime.component("edit", { component: RowEdit });
  runtime.component("delete", { component: RowDelete });
}
