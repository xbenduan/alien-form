import { describe, expect, it } from "vitest";
import {
  componentCatalog,
  getComponentMeta,
  getComponentOptions,
  isCompatibleComponent,
} from "./index";

describe("adapter component catalog", () => {
  it("keeps the configured component order", () => {
    expect(componentCatalog.slice(0, 5).map((item) => item.key)).toEqual([
      "Input",
      "Textarea",
      "NumberInput",
      "Select",
      "Switch",
    ]);
  });

  it("finds generic component metadata without business types", () => {
    expect(getComponentMeta("Input")).toMatchObject({
      key: "Input",
      value: "Input",
      meta: { fieldType: "string" },
    });
    expect(getComponentMeta("Missing")).toBeUndefined();
  });

  it("filters components by core field type", () => {
    expect(isCompatibleComponent("string", "Input")).toBe(true);
    expect(isCompatibleComponent("number", "Input")).toBe(false);
    expect(isCompatibleComponent("void", "SectionCard")).toBe(false);
    expect(getComponentOptions("boolean").map((item) => item.key)).toContain("Switch");
    expect(getComponentOptions("void")).toEqual([]);
  });
});
