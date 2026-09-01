import type { Runtime } from "@engine";
import { registerAntd } from "./antd";
import { ArrayCards, Input, NumberInput, ObjectField, Select, Switch, TextArea } from "./fields";
import { Filter, Layout, Table, Tree } from "./layouts";
import { Overlay, RecordForm, RecordPage } from "./pages";

export function registerComponents(runtime: Runtime): void {
  registerAntd(runtime);

  runtime.component({
    code: "Input",
    component: Input,
    adapter: "alien",
    meta: { type: "string", kind: "leaf", dataSource: false },
  });
  runtime.component({
    code: "TextArea",
    component: TextArea,
    adapter: "alien",
    meta: { type: "string", kind: "leaf", dataSource: false },
  });
  runtime.component({
    code: "NumberInput",
    component: NumberInput,
    adapter: "alien",
    meta: { type: "number", kind: "leaf", dataSource: false },
  });
  runtime.component({
    code: "Select",
    component: Select,
    adapter: "alien",
    meta: { type: "string", kind: "leaf", dataSource: true },
  });
  runtime.component({
    code: "Switch",
    component: Switch,
    adapter: "alien",
    meta: { type: "boolean", kind: "leaf", dataSource: false },
  });
  runtime.component({
    code: "ObjectField",
    component: ObjectField,
    adapter: "alien",
    meta: { type: "object", kind: "complex", children: "properties" },
  });
  runtime.component({
    code: "ArrayCards",
    component: ArrayCards,
    adapter: "alien",
    meta: { type: "array", kind: "complex", children: "items" },
  });

  runtime.component({ code: "layout", component: Layout, adapter: "alien" });
  runtime.component({ code: "filter", component: Filter, adapter: "alien" });
  runtime.component({ code: "table", component: Table, adapter: "alien" });
  runtime.component({ code: "tree", component: Tree, adapter: "alien" });
  runtime.component({ code: "record-page", component: RecordPage, adapter: "alien" });
  runtime.component({ code: "record-form", component: RecordForm, adapter: "alien" });
  runtime.component({ code: "overlay", component: Overlay, adapter: "alien" });
}
