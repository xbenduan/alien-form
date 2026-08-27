import type { UiDefinition, UiNode } from "@alien-form/engine";
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

export interface UiAuthoring {
  kind: "layout" | "content" | "action";
  parent?: string;
  children: boolean;
  props: false | { rows: number };
  create(): UiNode;
}

export type UiComponentDefinition = UiDefinition<any, UiAuthoring>;

function definition(
  code: string,
  title: string,
  kind: UiComponentDefinition["authoring"]["kind"],
  component: UiComponentDefinition["component"],
  options: {
    description?: string;
    parent?: string;
    children: boolean;
    props: false | { rows: number };
    slots?: string[];
    defaults?: UiNode;
  },
): UiComponentDefinition {
  return {
    code,
    title,
    description: options.description,
    component,
    slots: options.slots,
    authoring: {
      kind,
      parent: options.parent,
      children: options.children,
      props: options.props,
      create: () => structuredClone(options.defaults ?? { component: code }),
    },
  };
}

export const uiDefinitions: Record<string, UiComponentDefinition> = {
  layout: definition("layout", "标准页面布局", "layout", Layout, {
    description: "左侧栏与右侧主内容区布局。",
    children: false,
    props: { rows: 5 },
    slots: ["left", "rightTop", "rightBottom"],
  }),
  filter: definition("filter", "筛选表单", "content", Filter, {
    parent: "layout",
    children: false,
    props: { rows: 3 },
    defaults: { component: "filter", props: { scope: "main" } },
  }),
  table: definition("table", "数据表格", "content", TableLayout, {
    parent: "layout",
    children: true,
    props: { rows: 3 },
    slots: ["toolbarLeft", "toolbarRight"],
    defaults: { component: "table", props: { scope: "main" } },
  }),
  tree: definition("tree", "树形筛选", "content", TreePanel, {
    parent: "layout",
    children: false,
    props: { rows: 5 },
  }),
  "row-actions": definition("row-actions", "行操作组", "content", RowActions, {
    parent: "table",
    children: true,
    props: false,
  }),
  "action-group": definition("action-group", "操作组", "content", RowActions, {
    parent: "table",
    children: true,
    props: false,
  }),
  "action-add": definition("action-add", "新增", "action", ActionAdd, {
    parent: "action-group",
    children: false,
    props: { rows: 1 },
  }),
  "action-refresh": definition("action-refresh", "刷新", "action", ActionRefresh, {
    parent: "action-group",
    children: false,
    props: { rows: 1 },
  }),
  "action-batch-delete": definition(
    "action-batch-delete",
    "批量删除",
    "action",
    ActionBatchDelete,
    {
      parent: "table",
      children: false,
      props: { rows: 1 },
    },
  ),
  detail: definition("detail", "详情", "action", RowDetail, {
    parent: "row-actions",
    children: false,
    props: { rows: 1 },
  }),
  edit: definition("edit", "编辑", "action", RowEdit, {
    parent: "row-actions",
    children: false,
    props: { rows: 1 },
  }),
  delete: definition("delete", "删除", "action", RowDelete, {
    parent: "row-actions",
    children: false,
    props: { rows: 1 },
  }),
};
