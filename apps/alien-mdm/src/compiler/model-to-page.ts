import type { PageSchema, UiNode } from "@alien-form/engine";
import type { IFormSchema } from "@alien-form/core";
import type { Compiled, ModelSchema } from "./shared";

export type ModelPageScene = "list" | "add" | "edit" | "detail";

/** 深拷贝布局节点（layout 已是原生 UiNode，无插件标记）。 */
function cloneLayout(node: UiNode): UiNode {
  return JSON.parse(JSON.stringify(node)) as UiNode;
}

/** 递归向 table 节点注入已编译的列与 model，向 filter 绑定独立 form block。 */
function injectNode(node: UiNode, columns: unknown[], model: string): UiNode {
  let next: UiNode = node;
  if (node.component === "table") {
    next = { ...next, props: { ...next.props, columns, model } };
  } else if (node.component === "filter") {
    next = { ...next, block: "filter", props: { ...next.props, listBlock: "main" } };
  }
  if (next.children) {
    next = { ...next, children: next.children.map((c) => injectNode(c, columns, model)) };
  }
  if (next.slots) {
    const slots: Record<string, UiNode[]> = {};
    for (const [k, v] of Object.entries(next.slots)) {
      slots[k] = v.map((c) => injectNode(c, columns, model));
    }
    next = { ...next, slots };
  }
  return next;
}

/** 页面级元信息：透传给注册组件（行操作按 openMode 决定交互形态）。 */
function pageMeta(modelSchema: ModelSchema, scene: ModelPageScene): Record<string, unknown> {
  return {
    model: modelSchema.meta.name,
    title: modelSchema.meta.title,
    singularLabel: modelSchema.meta.singularLabel,
    openMode: modelSchema.meta.openMode,
    scene,
    mode: scene === "list" ? "edit" : scene,
  };
}

/**
 * 列表页 PageSchema：完全由 runtime 承接。
 * layout 直接取自模型的 x-layout（原生 UiNode），注入 columns 与 filter form block；
 * 追加一个 overlay 承接 drawer/modal 形态的新增/编辑/详情。
 */
export function buildListPageSchema(compiled: Compiled, modelSchema: ModelSchema): PageSchema {
  const modelName = modelSchema.meta.name;
  const contentLayout = injectNode(
    cloneLayout(compiled.layout as UiNode),
    compiled.columns,
    modelName,
  );

  return {
    id: `${modelName}:list`,
    domain: modelName,
    title: modelSchema.meta.title,
    meta: pageMeta(modelSchema, "list"),
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
      {
        name: "filter",
        type: "form",
        formSchema: compiled.filter as IFormSchema,
      },
    ],
    layout: {
      component: "record-page",
      children: [
        contentLayout,
        {
          component: "overlay",
          props: { title: modelSchema.meta.title },
        },
      ],
    },
  };
}

/**
 * 整页动作（add/edit/detail 为 openMode="page" 时）的 PageSchema。
 * 只挂一个 form block，交给 action-page 承接提交/返回。
 */
export function buildActionPageSchema(
  compiled: Compiled,
  modelSchema: ModelSchema,
  mode: "add" | "edit" | "detail",
  recordId?: string,
): PageSchema {
  const modelName = modelSchema.meta.name;
  return {
    id: `${modelName}:${mode}:${recordId ?? "new"}`,
    domain: modelName,
    title: modelSchema.meta.title,
    meta: pageMeta(modelSchema, mode),
    blocks: [
      {
        name: "form",
        type: "form",
        formSchema: compiled.form as IFormSchema,
      },
    ],
    layout: {
      component: "record-page",
      children: [
        {
          component: "action-page",
          block: "form",
          props: { mode, recordId, model: modelName },
        },
      ],
    },
  };
}
