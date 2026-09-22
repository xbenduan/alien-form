import { defineComponent, type Runtime } from "@alien-form/engine";
import { ArrayCards } from "./array-cards";
import { DatePicker } from "./date-picker";
import { FormItem } from "./form-item";
import { Input, NumberInput, TextArea } from "./input";
import { ObjectField } from "./object-field";
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
        type: "string",
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
        type: "string",
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
        type: "number",
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
        type: "string",
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
    }),
  );
  runtime.component(
    "RemoteSelect",
    defineComponent(RemoteSelect, {
      injectContext: true,
      meta: {
        type: "string",
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
        type: "string",
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
    "ObjectField",
    defineComponent(ObjectField, {
      injectContext: true,
      meta: {
        type: "object",
        kind: "complex",
        children: "properties",
        sample: {
          type: "object",
          component: "ObjectField",
          props: { gridSpan: 12 },
          properties: {},
        },
      },
    }),
  );
  runtime.component(
    "ArrayCards",
    defineComponent(ArrayCards, {
      injectContext: true,
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
    }),
  );
}
