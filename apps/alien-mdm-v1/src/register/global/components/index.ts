import type { Runtime } from "@engine";
import { registerAntd } from "./antd";
import { ArrayCards, Input, NumberInput, ObjectField, Select, TextArea } from "./fields";
import { registerLayouts } from "./layouts";
import { registerPages } from "./pages";

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

  registerLayouts(runtime);
  registerPages(runtime);
}
