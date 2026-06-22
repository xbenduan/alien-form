import { describe, expect, it } from "vitest";
import {
  defineAdapter,
  type AdapterCatalogItem,
} from "../define/adapters";
import {
  buildSceneComponents,
  buildScenes,
  defaultMode,
  resolveSceneRender,
} from "./scene-resolver";

function catalogItem(partial: Partial<AdapterCatalogItem> & Pick<AdapterCatalogItem, "key" | "scenes">): AdapterCatalogItem {
  return {
    name: partial.key,
    key: partial.key,
    label: partial.label ?? partial.key,
    description: partial.description ?? "",
    kind: partial.kind ?? "component",
    scenes: partial.scenes,
    meta: partial.meta ?? {},
    params: partial.params ?? [],
  };
}

const catalog: AdapterCatalogItem[] = [
  catalogItem({
    key: "Input",
    scenes: {
      form: { mode: "edit" },
      filter: { mode: "filter", operator: "contains" },
      detail: { renderAs: "DisplayText" },
      table: { renderAs: "DisplayText", summary: true },
    },
  }),
  catalogItem({
    key: "Switch",
    scenes: {
      form: { mode: "edit" },
      filter: { renderAs: "Select" },
      detail: { renderAs: "DisplayBoolean" },
    },
  }),
  catalogItem({ key: "Select", scenes: { form: { mode: "edit" }, filter: { mode: "filter", operator: "in" } } }),
  catalogItem({ key: "DisplayText", kind: "display", scenes: { detail: { mode: "readonly" }, table: { mode: "cell" } } }),
  catalogItem({ key: "DisplayBoolean", kind: "display", scenes: { detail: { mode: "readonly" }, table: { mode: "cell" } } }),
  catalogItem({ key: "FormItem", kind: "decorator", scenes: { form: {}, detail: {} } }),
];

describe("defaultMode", () => {
  it("maps each scene to its default mode", () => {
    expect(defaultMode("form")).toBe("edit");
    expect(defaultMode("filter")).toBe("filter");
    expect(defaultMode("detail")).toBe("readonly");
    expect(defaultMode("table")).toBe("cell");
    expect(defaultMode("builder")).toBe("readonly");
  });
});

describe("resolveSceneRender", () => {
  it("delegates via renderAs (one hop) for the detail scene", () => {
    const resolved = resolveSceneRender({ component: "Input" }, "detail", catalog);
    expect(resolved?.componentKey).toBe("DisplayText");
    expect(resolved?.mode).toBe("readonly");
  });

  it("delegates Switch to Select in the filter scene", () => {
    const resolved = resolveSceneRender({ component: "Switch" }, "filter", catalog);
    expect(resolved?.componentKey).toBe("Select");
  });

  it("infers the start component from field.type when component is absent", () => {
    const resolved = resolveSceneRender({ type: "string" }, "form", catalog);
    expect(resolved?.componentKey).toBe("Input");
    expect(resolved?.mode).toBe("edit");
  });

  it("returns undefined when the component does not declare the scene", () => {
    // Select declares no table scene
    expect(resolveSceneRender({ component: "Select" }, "table", catalog)).toBeUndefined();
  });

  it("returns undefined when the component is unknown", () => {
    expect(resolveSceneRender({ component: "Nope" }, "form", catalog)).toBeUndefined();
  });

  it("merges props with x-cms[scene].props taking highest priority", () => {
    const resolved = resolveSceneRender(
      {
        component: "Input",
        props: { placeholder: "from-field", size: "small" },
        "x-cms": { filter: { props: { placeholder: "from-xcms" } } },
      },
      "filter",
      catalog,
    );
    expect(resolved?.props.placeholder).toBe("from-xcms");
    expect(resolved?.props.size).toBe("small");
  });

  it("prefers x-cms.filter.operator over the variant default operator", () => {
    const fromVariant = resolveSceneRender({ component: "Input" }, "filter", catalog);
    expect(fromVariant?.operator).toBe("contains");

    const fromXcms = resolveSceneRender(
      { component: "Input", "x-cms": { filter: { operator: "eq" } } },
      "filter",
      catalog,
    );
    expect(fromXcms?.operator).toBe("eq");
  });

  it("derives table summary from variant and x-cms.table.expandable", () => {
    const fromVariant = resolveSceneRender({ component: "Input" }, "table", catalog);
    expect(fromVariant?.summary).toBe(true);

    const fromXcms = resolveSceneRender(
      { component: "Input", "x-cms": { table: { expandable: false } } },
      "table",
      catalog,
    );
    expect(fromXcms?.summary).toBe(false);
  });

  it("normalizes string scene entries as { renderAs }", () => {
    const stringCatalog: AdapterCatalogItem[] = [
      catalogItem({ key: "Input", scenes: { form: "Other" } }),
      catalogItem({ key: "Other", scenes: { form: {} } }),
    ];
    const resolved = resolveSceneRender({ component: "Input" }, "form", stringCatalog);
    expect(resolved?.componentKey).toBe("Other");
    expect(resolved?.mode).toBe(defaultMode("form"));
  });
});

describe("buildSceneComponents", () => {
  const componentMap: Record<string, string> = {
    Input: "InputComp",
    Switch: "SwitchComp",
    Select: "SelectComp",
    DisplayText: "DisplayTextComp",
    DisplayBoolean: "DisplayBooleanComp",
    FormItem: "FormItemComp",
  };

  it("maps each participating adapter key to its target component", () => {
    const detail = buildSceneComponents("detail", catalog, componentMap);
    // Input delegates to DisplayText in detail
    expect(detail.Input).toBe("DisplayTextComp");
    expect(detail.Switch).toBe("DisplayBooleanComp");
    // DisplayText itself participates in detail
    expect(detail.DisplayText).toBe("DisplayTextComp");
    expect(detail.FormItem).toBe("FormItemComp");
    // Select does not declare detail
    expect(detail.Select).toBeUndefined();
  });

  it("applies the wrap function with resolved mode", () => {
    const wrapped = buildSceneComponents(
      "detail",
      catalog,
      componentMap,
      (component, mode) => `${component}#${mode}`,
    );
    expect(wrapped.Input).toBe("DisplayTextComp#readonly");
  });

  it("only includes keys whose scene is declared", () => {
    const filter = buildSceneComponents("filter", catalog, componentMap);
    expect(Object.keys(filter).sort()).toEqual(["Input", "Select", "Switch"]);
    expect(filter.Switch).toBe("SelectComp");
  });
});

describe("buildScenes", () => {
  function makeAdapter(key: string, scenes: AdapterCatalogItem["scenes"]) {
    function Component() {
      return null;
    }
    return defineAdapter(Component, {
      key,
      label: key,
      description: "",
      kind: "component",
      scenes,
    });
  }

  it("returns a component table that contains all adapters declaring the scene", () => {
    const adapters = {
      InputAdapter: makeAdapter("Input", { form: {}, detail: "DisplayText" }),
      SwitchAdapter: makeAdapter("Switch", { form: {}, detail: "DisplayBoolean" }),
      DisplayTextAdapter: makeAdapter("DisplayText", { detail: {} }),
      DisplayBooleanAdapter: makeAdapter("DisplayBoolean", { detail: {} }),
      // 非 adapter helper：应该被静默跳过
      helperFn: () => 1,
      meta: { foo: "bar" },
    };

    const formComponents = buildScenes(adapters, "form");
    expect(Object.keys(formComponents).sort()).toEqual(["Input", "Switch"]);
    expect(typeof formComponents.Input).toBe("function");
  });

  it("supports the string scene entry sugar end-to-end", () => {
    const adapters = {
      InputAdapter: makeAdapter("Input", { form: "Other" }),
      OtherAdapter: makeAdapter("Other", { form: {} }),
    };

    const components = buildScenes(adapters, "form");
    // Input.form === "Other" 字符串短语糖：Input 槽位拿到 Other 组件
    expect(components.Input).toBe(adapters.OtherAdapter);
    expect(components.Other).toBe(adapters.OtherAdapter);
  });

  it("forwards mode and props to the wrap callback", () => {
    const adapters = {
      InputAdapter: makeAdapter("Input", {
        detail: { renderAs: "DisplayText", props: { foo: 1 } },
      }),
      DisplayTextAdapter: makeAdapter("DisplayText", { detail: { mode: "readonly" } }),
    };

    const calls: Array<{ mode: string; props: Record<string, unknown> }> = [];
    buildScenes(adapters, "detail", (component, mode, props) => {
      calls.push({ mode, props });
      return component;
    });

    const inputCall = calls.find((entry) => entry.props.foo === 1);
    expect(inputCall?.mode).toBe("readonly");
  });
});
