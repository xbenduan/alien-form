import type { Runtime } from "@alien-form/engine";
import { Layout } from "./layout";
import { Filter } from "./filter";
import { TableLayout } from "./table";
import { TreePanel } from "./tree";
import {
  ActionAdd,
  ActionBatchDelete,
  ActionRefresh,
  RowActions,
  RowDelete,
  RowDetail,
  RowEdit,
} from "./actions";
import { registerUiComponent } from "@utils/register-ui-component";

export function registerUIComponents(runtime: Runtime): void {
  registerUiComponent(runtime, "layout", "标准页面布局", "layout", Layout, {
    description: "左侧栏与右侧主内容区布局。",
    children: false,
    props: { rows: 5 },
    slots: ["left", "rightTop", "rightBottom"],
  });
  registerUiComponent(runtime, "filter", "筛选表单", "content", Filter, {
    parent: "layout",
    children: false,
    props: { rows: 3 },
    defaults: { component: "filter", props: { scope: "main" } },
  });
  registerUiComponent(runtime, "table", "数据表格", "content", TableLayout, {
    parent: "layout",
    children: true,
    props: { rows: 3 },
    slots: ["toolbarLeft", "toolbarRight"],
    defaults: { component: "table", props: { scope: "main" } },
  });
  registerUiComponent(runtime, "tree", "树形筛选", "content", TreePanel, {
    parent: "layout",
    children: false,
    props: { rows: 5 },
  });
  registerUiComponent(runtime, "row-actions", "行操作组", "content", RowActions, {
    parent: "table",
    children: true,
    props: { show: false },
  });
  registerUiComponent(runtime, "action-group", "操作组", "content", RowActions, {
    parent: "table",
    children: true,
    props: { show: false },
  });
  registerUiComponent(runtime, "action-add", "新增", "action", ActionAdd, {
    parent: "action-group",
    children: false,
    props: { rows: 1 },
  });
  registerUiComponent(runtime, "action-refresh", "刷新", "action", ActionRefresh, {
    parent: "action-group",
    children: false,
    props: { rows: 1 },
  });
  registerUiComponent(runtime, "action-batch-delete", "批量删除", "action", ActionBatchDelete, {
    parent: "table",
    children: false,
    props: { rows: 1 },
  });
  registerUiComponent(runtime, "detail", "详情", "action", RowDetail, {
    parent: "row-actions",
    children: false,
    props: { rows: 1 },
  });
  registerUiComponent(runtime, "edit", "编辑", "action", RowEdit, {
    parent: "row-actions",
    children: false,
    props: { rows: 1 },
  });
  registerUiComponent(runtime, "delete", "删除", "action", RowDelete, {
    parent: "row-actions",
    children: false,
    props: { rows: 1 },
  });
}
