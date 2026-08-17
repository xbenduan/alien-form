import type { IFieldSchema } from "@alien-form/core";
import { describe, expect, it } from "vitest";
import { defineAdapter, type AdapterCatalogItem, type SceneMap } from "./adapter";
import {
  buildSceneComponents,
  buildScenes,
  defaultMode,
  resolveSceneRender,
} from "./scene-resolver";

function catalogItem(key: string, scenes: SceneMap): AdapterCatalogItem {
  return {
    name: key,
    key,
    label: key,
    description: "",
    kind: "component",
    scenes,
    meta: {},
    params: [],
  };
}

const catalog: AdapterCatalogItem[] = [
  catalogItem("Input", {
    form: {},
    filter: { operator: "contains", props: { size: "small" } },
    detail: "DisplayText",
    table: { renderAs: "DisplayText", summary: true },
  }),
  catalogItem("Switch", {
    form: {},
    filter: "Select",
    detail: "DisplayBoolean",
  }),
  catalogItem("Select", { form: {}, filter: {} }),
  catalogItem("DisplayText", { detail: {}, table: {} }),
  catalogItem("DisplayBoolean", { detail: {}, table: {} }),
];

describe("defaultMode", () => {
  it("maps every scene to its default mode", () => {
    expect(defaultMode("form")).toBe("edit");
    expect(defaultMode("filter")).toBe("filter");
    expect(defaultMode("detail")).toBe("readonly");
    expect(defaultMode("table")).toBe("cell");
  });
});

describe("resolveSceneRender", () => {
  it("uses a core field schema and follows renderAs by one hop", () => {
    const resolved = resolveSceneRender({ component: "Input" }, "detail", catalog);

    expect(resolved?.componentKey).toBe("DisplayText");
    expect(resolved?.mode).toBe("readonly");
    expect(resolved?.trace).toContain("Input --renderAs[detail]--> DisplayText");
  });

  it("infers the adapter from field type and x-layout", () => {
    expect(resolveSceneRender({ type: "string" }, "form", catalog)?.componentKey).toBe("Input");

    const layoutCatalog = [catalogItem("GridLayout", { form: {} })];
    expect(
      resolveSceneRender({ "x-layout": "GridLayout" }, "form", layoutCatalog)?.componentKey,
    ).toBe("GridLayout");
  });

  it("returns undefined when a field type has no known fallback", () => {
    const sectionCatalog = [catalogItem("SectionCard", { form: {} })];
    const unknownTypeField = { type: "future-field-type" } as unknown as IFieldSchema;

    expect(resolveSceneRender({ type: "object" }, "form", sectionCatalog)?.componentKey).toBe(
      "SectionCard",
    );
    expect(resolveSceneRender(unknownTypeField, "form", sectionCatalog)).toBeUndefined();
  });

  it("merges explicit scene overrides after adapter and field props", () => {
    const resolved = resolveSceneRender(
      {
        component: "Input",
        props: { size: "middle", placeholder: "field" },
      },
      "filter",
      catalog,
      {
        componentKey: "Select",
        mode: "readonly",
        props: { placeholder: "override" },
        operator: "eq",
        summary: false,
      },
    );

    expect(resolved).toMatchObject({
      componentKey: "Select",
      mode: "readonly",
      props: { size: "middle", placeholder: "override" },
      operator: "eq",
      summary: false,
    });
  });

  it("returns undefined for unknown adapters or undeclared scenes", () => {
    expect(resolveSceneRender({ component: "Unknown" }, "form", catalog)).toBeUndefined();
    expect(resolveSceneRender({ component: "Select" }, "table", catalog)).toBeUndefined();
  });
});

describe("scene component registries", () => {
  const componentMap = {
    Input: "InputComponent",
    Switch: "SwitchComponent",
    Select: "SelectComponent",
    DisplayText: "DisplayTextComponent",
    DisplayBoolean: "DisplayBooleanComponent",
  };

  it("maps scene entries to renderAs targets and default modes", () => {
    const components = buildSceneComponents(
      "detail",
      catalog,
      componentMap,
      (component, mode) => `${component}#${mode}`,
    );

    expect(components.Input).toBe("DisplayTextComponent#readonly");
    expect(components.Switch).toBe("DisplayBooleanComponent#readonly");
    expect(components.Select).toBeUndefined();
  });

  it("derives scene components from an adapter namespace", () => {
    const makeAdapter = (key: string, scenes: SceneMap) =>
      defineAdapter(() => null, {
        key,
        label: key,
        description: "",
        kind: "component",
        scenes,
      });
    const adapters = {
      InputAdapter: makeAdapter("Input", { detail: "DisplayText" }),
      DisplayTextAdapter: makeAdapter("DisplayText", { detail: {} }),
      helper: { value: true },
    };

    const components = buildScenes(adapters, "detail");

    expect(components.Input).toBe(adapters.DisplayTextAdapter);
    expect(components.DisplayText).toBe(adapters.DisplayTextAdapter);
  });
});
