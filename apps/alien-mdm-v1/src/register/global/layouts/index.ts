import type { Runtime } from "@engine";
import { Filter } from "./filter";
import { Layout } from "./layout";
import { Table } from "./table";
import { Tree } from "./tree";

export function registerLayouts(runtime: Runtime): void {
  runtime.component({ code: "layout", component: Layout, adapter: "page" });
  runtime.component({ code: "filter", component: Filter, adapter: "page" });
  runtime.component({ code: "table", component: Table, adapter: "page" });
  runtime.component({ code: "tree", component: Tree, adapter: "page" });
}
