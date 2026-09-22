import { defineComponent, type Runtime } from "@alien-form/engine";
import { Filter } from "./filter";
import { Layout } from "./layout";
import { Menu } from "./menu";
import { BatchButton, RecordActionButton, RowButton, Table } from "./table";
import { TreeLayout } from "./tree";

export function registerLayouts(runtime: Runtime): void {
  runtime.component(
    "row-button",
    defineComponent(RowButton, {
      injectContext: true,
      meta: {
        scope: ["$row", "$service", "$utils", "$enums", "$query"],
        props: {
          children: { type: "node" },
          disabled: { type: ["boolean", "function"], expression: true },
          onClick: { type: "function", required: true, expression: true },
          refreshAfterSuccess: { type: "boolean" },
        },
      },
    }),
  );
  runtime.component(
    "record-action",
    defineComponent(RecordActionButton, {
      injectContext: true,
      meta: {
        scope: ["$row", "$service", "$utils", "$enums", "$query"],
        props: {
          mode: { type: "string", required: true },
          openMode: { type: "string" },
          children: { type: "node" },
          disabled: { type: ["boolean", "function"], expression: true },
        },
      },
    }),
  );
  runtime.component(
    "batch-button",
    defineComponent(BatchButton, {
      injectContext: true,
      meta: {
        scope: ["$service", "$utils", "$enums", "$query"],
        props: {
          children: { type: "node" },
          onClick: { type: "function", required: true, expression: true },
          confirm: { type: "node" },
          refreshAfterSuccess: { type: "boolean" },
        },
      },
    }),
  );
  runtime.component(
    "layout",
    defineComponent(Layout, {
      injectContext: true,
      meta: { slots: { left: {}, content: { multiple: true } } },
    }),
  );
  runtime.component(
    "Menu",
    defineComponent(Menu, {
      injectContext: true,
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
    }),
  );
  runtime.component("filter", defineComponent(Filter, { injectContext: true }));
  runtime.component(
    "table",
    defineComponent(Table, {
      injectContext: true,
      meta: {
        slots: {
          toolbar: { multiple: true },
          batchActions: { multiple: true },
          rowActions: { multiple: true, scope: ["$row"] },
        },
        scope: ["$form", "$query", "$service", "$utils", "$enums"],
        props: {
          rowKey: { type: "string" },
          modelCode: { type: "string", required: true },
          schema: { type: "object", required: true },
          columns: { type: ["array", "function"], required: true, expression: true },
          filter: { type: "object", expression: true },
          parentId: { type: ["string", "number"], expression: true },
          loadData: { type: "function", required: true, expression: true },
        },
      },
    }),
  );
  runtime.component(
    "tree",
    defineComponent(TreeLayout, {
      injectContext: true,
      meta: {
        type: "string",
        kind: "leaf",
        props: {
          model: { type: "string", required: true },
          loadData: { type: "function", required: true, expression: true },
          valueField: { type: "string", required: true },
          parentField: { type: "string", required: true },
          labelField: { type: "string", required: true },
          showRoot: { type: "boolean" },
        },
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
    }),
  );
}
