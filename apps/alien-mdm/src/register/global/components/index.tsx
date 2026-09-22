import { defineComponent, type Runtime } from "@alien-form/engine";
import { Card } from "./card";
import { DatePicker } from "./date-picker";
import { FormItem } from "./form-item";
import { Input, NumberInput, TextArea } from "./input";
import { RemoteSelect } from "./remote-select";
import { Select } from "./select";
import { TreeSelect } from "./tree-select";

export function registerComponents(runtime: Runtime): void {
  runtime.component("FormItem", defineComponent(FormItem, { injectContext: true }));
  runtime.component(
    "Input",
    defineComponent(Input, {
      injectContext: true,
      meta: {
        types: ["string"],
        kind: "leaf",
        dataSource: false,
        sample: { type: "string", component: "Input", props: { placeholder: "请输入" } },
      },
    }),
  );
  runtime.component(
    "TextArea",
    defineComponent(TextArea, {
      injectContext: true,
      meta: {
        types: ["string"],
        kind: "leaf",
        dataSource: false,
        sample: {
          type: "string",
          component: "TextArea",
          props: { rows: 3, placeholder: "请输入" },
        },
      },
    }),
  );
  runtime.component(
    "NumberInput",
    defineComponent(NumberInput, {
      injectContext: true,
      meta: {
        types: ["number"],
        kind: "leaf",
        dataSource: false,
        sample: { type: "number", component: "NumberInput", props: { min: 0 } },
      },
    }),
  );
  runtime.component(
    "DatePicker",
    defineComponent(DatePicker, {
      injectContext: true,
      meta: {
        types: ["string"],
        kind: "leaf",
        dataSource: false,
        sample: { type: "string", component: "DatePicker" },
      },
    }),
  );
  runtime.component(
    "Select",
    defineComponent(Select, {
      injectContext: true,
      meta: {
        types: ["string", "boolean", "array"],
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
    }),
  );
  runtime.component(
    "RemoteSelect",
    defineComponent(RemoteSelect, {
      injectContext: true,
      meta: {
        types: ["string", "array"],
        kind: "leaf",
        dataSource: false,
        props: {
          model: { type: "string", required: true },
          loadOptions: { type: "function", required: true, expression: true },
          valueField: { type: "string", required: true },
          labelField: { type: "string", required: true },
          pageSize: { type: "number" },
          multiple: { type: "boolean" },
        },
        sample: {
          type: "string",
          component: "RemoteSelect",
          props: {
            model: "example_model",
            loadOptions: '{{ $utils.relation($service("records.list")) }}',
            valueField: "id",
            labelField: "name",
            pageSize: 10,
          },
        },
      },
    }),
  );
  runtime.component(
    "TreeSelect",
    defineComponent(TreeSelect, {
      injectContext: true,
      meta: {
        types: ["string"],
        kind: "leaf",
        dataSource: false,
        props: {
          model: { type: "string", required: true },
          loadData: { type: "function", required: true, expression: true },
          valueField: { type: "string", required: true },
          parentField: { type: "string", required: true },
          labelField: { type: "string", required: true },
          disabledValues: { type: "array", expression: true },
        },
        sample: {
          type: "string",
          component: "TreeSelect",
          props: {
            model: "example_model",
            parentField: "parentId",
            valueField: "id",
            labelField: "name",
            loadData: '{{ $utils.tree($service("records.subtree")) }}',
          },
        },
      },
    }),
  );
  runtime.component(
    "Card",
    defineComponent(Card, {
      injectContext: true,
      meta: {
        types: ["object", "array", "void"],
        kind: "complex",
        sample: {
          type: "object",
          component: "Card",
          props: { gridSpan: 12 },
          properties: {},
        },
      },
    }),
  );
}
