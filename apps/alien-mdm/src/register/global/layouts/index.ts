import type { Runtime } from "@alien-form/engine";
import { Filter } from "./filter";
import { Layout } from "./layout";
import { Menu } from "./menu";
import { RowButton, Table } from "./table";
import { Tree } from "./tree";

export function registerLayouts(runtime: Runtime): void {
  runtime.component({ code: "row-button", component: RowButton, adapter: "page" });
  runtime.component({ code: "layout", component: Layout, adapter: "page" });
  runtime.component({
    code: "Menu",
    component: Menu,
    adapter: "page",
    meta: {
      type: "void",
      kind: "leaf",
      sample: {
        type: "void",
        component: "Menu",
        props: {
          title: "菜单",
          items: [
            { key: "one", label: "菜单项一" },
            { key: "two", label: "菜单项二" },
          ],
        },
      },
    },
  });
  runtime.component({ code: "filter", component: Filter, adapter: "page" });
  runtime.component({ code: "table", component: Table, adapter: "page" });
  runtime.component({
    code: "tree",
    component: Tree,
    adapter: "page",
    meta: {
      type: "string",
      kind: "leaf",
      sample: {
        type: "string",
        component: "tree",
        props: {
          model: "example_model",
          valueField: "id",
          parentField: "parentId",
          labelField: "name",
          showRoot: false,
          loadData: '{{ $utils.tree($service("records.subtree")) }}',
        },
      },
    },
  });
}
