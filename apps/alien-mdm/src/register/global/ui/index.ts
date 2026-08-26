import type { Runtime } from "@alien-form/engine";
import { Page } from "./page";
import { TreeLayout } from "./layout";
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
import { RecordOverlay } from "./overlay";
import { RecordActionPageLayout } from "./action-page";

export function registerUIComponents(runtime: Runtime): void {
  runtime.component("page", { component: Page });
  runtime.component("treelayout", { component: TreeLayout, slots: ["tree", "filter", "table"] });
  runtime.component("filter", { component: Filter });
  runtime.component("table", {
    component: TableLayout,
    slots: ["toolbarLeft", "toolbarRight"],
  });
  runtime.component("tree", { component: TreePanel });
  runtime.component("action-add", { component: ActionAdd });
  runtime.component("action-refresh", { component: ActionRefresh });
  runtime.component("action-batch-delete", { component: ActionBatchDelete });
  runtime.component("row-actions", { component: RowActions });
  runtime.component("detail", { component: RowDetail });
  runtime.component("edit", { component: RowEdit });
  runtime.component("delete", { component: RowDelete });
  runtime.component("record-overlay", { component: RecordOverlay });
  runtime.component("record-action-page", { component: RecordActionPageLayout });
}
