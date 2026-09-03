import type { Runtime } from "@engine";
import { ArrayCards } from "./array-cards";
import { ObjectField } from "./object-field";
import { Input, NumberInput, Select, TextArea } from "./primitive";

export { Input, NumberInput, Select, TextArea } from "./primitive";
export { ObjectField } from "./object-field";
export { ArrayCards } from "./array-cards";

export function registerFields(runtime: Runtime): void {
  runtime.component({
    code: "Input",
    component: Input,
    adapter: "form",
    meta: {
      type: "string",
      kind: "leaf",
      dataSource: false,
      sample: { type: "string", component: "Input", props: { placeholder: "请输入" } },
    },
  });
  runtime.component({
    code: "TextArea",
    component: TextArea,
    adapter: "form",
    meta: {
      type: "string",
      kind: "leaf",
      dataSource: false,
      sample: { type: "string", component: "TextArea", props: { rows: 3, placeholder: "请输入" } },
    },
  });
  runtime.component({
    code: "NumberInput",
    component: NumberInput,
    adapter: "form",
    meta: {
      type: "number",
      kind: "leaf",
      dataSource: false,
      sample: { type: "number", component: "NumberInput", props: { min: 0 } },
    },
  });
  runtime.component({
    code: "Select",
    component: Select,
    adapter: "form",
    meta: {
      type: "string",
      kind: "leaf",
      dataSource: true,
      sample: {
        type: "string",
        component: "Select",
        dataSource: [
          { label: "选项一", value: "a" },
          { label: "选项二", value: "b" },
        ],
      },
    },
  });
  runtime.component({
    code: "ObjectField",
    component: ObjectField,
    adapter: "form",
    meta: {
      type: "object",
      kind: "complex",
      children: "properties",
      sample: { type: "object", component: "ObjectField", props: { gridSpan: 12 }, properties: {} },
    },
  });
  runtime.component({
    code: "ArrayCards",
    component: ArrayCards,
    adapter: "form",
    meta: {
      type: "array",
      kind: "complex",
      children: "items",
      sample: {
        type: "array",
        component: "ArrayCards",
        props: { gridSpan: 12 },
        items: { type: "object", properties: {} },
      },
    },
  });
}
