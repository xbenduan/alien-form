import { describe, expect, it } from "vitest";
import type { AdapterCatalogItem } from "../define/adapters";
import {
  buildSceneComponents,
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
      recordForm: { mode: "edit" },
      recordFilter: { mode: "filter", operator: "contains" },
      recordDetail: { renderAs: "DisplayText" },
      tableCell: { renderAs: "DisplayText", summary: true },
    },
  }),
  catalogItem({
    key: "Switch",
    scenes: {
      recordForm: { mode: "edit" },
      recordFilter: { renderAs: "Select" },
      recordDetail: { renderAs: "DisplayBoolean" },
    },
  }),
  catalogItem({ key: "Select", scenes: { recordForm: { mode: "edit" }, recordFilter: { mode: "filter", operator: "in" } } }),
  catalogItem({ key: "DisplayText", kind: "display", scenes: { recordDetail: { mode: "readonly" }, tableCell: { mode: "cell" } } }),
  catalogItem({ key: "DisplayBoolean", kind: "display", scenes: { recordDetail: { mode: "readonly" }, tableCell: { mode: "cell" } } }),
  catalogItem({ key: "FormItem", kind: "decorator", scenes: { recordForm: {}, recordDetail: {} } }),
];

describe("defaultMode", () => {
  it("maps each scene to its default mode", () => {
    expect(defaultMode("recordForm")).toBe("edit");
    expect(defaultMode("recordFilter")).toBe("filter");
    expect(defaultMode("recordDetail")).toBe("readonly");
    expect(defaultMode("tableCell")).toBe("cell");
    expect(defaultMode("builder")).toBe("readonly");
  });
});

describe("resolveSceneRender", () => {
  it("delegates via renderAs (one hop) for the detail scene", () => {
    const resolved = resolveSceneRender({ component: "Input" }, "recordDetail", catalog);
    expect(resolved?.componentKey).toBe("DisplayText");
    expect(resolved?.mode).toBe("readonly");
  });

  it("delegates Switch to Select in the filter scene", () => {
    const resolved = resolveSceneRender({ component: "Switch" }, "recordFilter", catalog);
    expect(resolved?.componentKey).toBe("Select");
  });

  it("infers the start component from field.type when component is absent", () => {
    const resolved = resolveSceneRender({ type: "string" }, "recordForm", catalog);
    expect(resolved?.componentKey).toBe("Input");
    expect(resolved?.mode).toBe("edit");
  });

  it("returns undefined when the component does not declare the scene", () => {
    // Select declares no tableCell scene
    expect(resolveSceneRender({ component: "Select" }, "tableCell", catalog)).toBeUndefined();
  });

  it("returns undefined when the component is unknown", () => {
    expect(resolveSceneRender({ component: "Nope" }, "recordForm", catalog)).toBeUndefined();
  });

  it("merges props with x-cms[scene].props taking highest priority", () => {
    const resolved = resolveSceneRender(
      {
        component: "Input",
        props: { placeholder: "from-field", size: "small" },
        "x-cms": { filter: { props: { placeholder: "from-xcms" } } },
      },
      "recordFilter",
      catalog,
    );
    expect(resolved?.props.placeholder).toBe("from-xcms");
    expect(resolved?.props.size).toBe("small");
  });

  it("prefers x-cms.filter.operator over the variant default operator", () => {
    const fromVariant = resolveSceneRender({ component: "Input" }, "recordFilter", catalog);
    expect(fromVariant?.operator).toBe("contains");

    const fromXcms = resolveSceneRender(
      { component: "Input", "x-cms": { filter: { operator: "eq" } } },
      "recordFilter",
      catalog,
    );
    expect(fromXcms?.operator).toBe("eq");
  });

  it("derives tableCell summary from variant and x-cms.table.expandable", () => {
    const fromVariant = resolveSceneRender({ component: "Input" }, "tableCell", catalog);
    expect(fromVariant?.summary).toBe(true);

    const fromXcms = resolveSceneRender(
      { component: "Input", "x-cms": { table: { expandable: false } } },
      "tableCell",
      catalog,
    );
    expect(fromXcms?.summary).toBe(false);
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
    const detail = buildSceneComponents("recordDetail", catalog, componentMap);
    // Input delegates to DisplayText in detail
    expect(detail.Input).toBe("DisplayTextComp");
    expect(detail.Switch).toBe("DisplayBooleanComp");
    // DisplayText itself participates in detail
    expect(detail.DisplayText).toBe("DisplayTextComp");
    expect(detail.FormItem).toBe("FormItemComp");
    // Select does not declare recordDetail
    expect(detail.Select).toBeUndefined();
  });

  it("applies the wrap function with resolved mode", () => {
    const wrapped = buildSceneComponents(
      "recordDetail",
      catalog,
      componentMap,
      (component, mode) => `${component}#${mode}`,
    );
    expect(wrapped.Input).toBe("DisplayTextComp#readonly");
  });

  it("only includes keys whose scene is declared", () => {
    const filter = buildSceneComponents("recordFilter", catalog, componentMap);
    expect(Object.keys(filter).sort()).toEqual(["Input", "Select", "Switch"]);
    expect(filter.Switch).toBe("SelectComp");
  });
});
