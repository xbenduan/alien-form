import type { PageSchema, UiNode } from "@alien-form/engine";
import type { IFormSchema } from "@alien-form/core";
import type { Compiled, ModelSchema } from "./shared";

function stripPluginMarker(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripPluginMarker);
  if (node && typeof node === "object") {
    const { plugin, ...rest } = node as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      result[key] = stripPluginMarker(value);
    }
    return result;
  }
  return node;
}

function injectTableProps(node: UiNode, columns: unknown[], model: string): UiNode {
  if (node.component === "table") {
    return {
      ...node,
      props: { ...node.props, columns, model },
    };
  }
  if (node.component === "filter") {
    return {
      ...node,
      props: { ...node.props, filterSchema: (node.props as Record<string, unknown>)?.filterSchema },
    };
  }
  if (node.children) {
    return { ...node, children: node.children.map((c) => injectTableProps(c, columns, model)) };
  }
  if (node.slots) {
    const slots: Record<string, UiNode[]> = {};
    for (const [k, v] of Object.entries(node.slots)) {
      slots[k] = v.map((c) => injectTableProps(c, columns, model));
    }
    return { ...node, slots };
  }
  return node;
}

function injectFilterSchema(node: UiNode, filterSchema: IFormSchema): UiNode {
  if (node.component === "filter") {
    return { ...node, props: { ...node.props, filterSchema } };
  }
  if (node.children) {
    return { ...node, children: node.children.map((c) => injectFilterSchema(c, filterSchema)) };
  }
  if (node.slots) {
    const slots: Record<string, UiNode[]> = {};
    for (const [k, v] of Object.entries(node.slots)) {
      slots[k] = v.map((c) => injectFilterSchema(c, filterSchema));
    }
    return { ...node, slots };
  }
  return node;
}

export function compiledToPageSchema(compiled: Compiled, modelSchema: ModelSchema): PageSchema {
  const rawLayout = compiled.layout as UiNode & { plugin?: string };
  let layout = stripPluginMarker(rawLayout) as UiNode;
  const modelName = modelSchema.meta.name;
  layout = injectTableProps(layout, compiled.columns, modelName);
  layout = injectFilterSchema(layout, compiled.filter as IFormSchema);

  layout.children = [
    ...(layout.children ?? []),
    {
      component: "record-overlay",
      props: {
        formSchema: compiled.form,
        title: modelSchema.meta.title,
        width: 480,
      },
    },
  ];

  return {
    id: modelName,
    title: modelSchema.meta.title,
    blocks: [
      {
        name: "main",
        type: "list",
        service: "records.list",
        params: { model: modelName },
        pagination: { current: 1, pageSize: modelSchema.meta.defaultPageSize ?? 10 },
      },
      {
        name: "form",
        type: "form",
        formSchema: compiled.form as IFormSchema,
      },
    ],
    layout,
  };
}
