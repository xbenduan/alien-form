import { describe, it, expect } from "vitest";
import { kindOf, normalizeComponent } from "../src/schema";
import type { IFieldSchema } from "../src/schema";

describe("kindOf", () => {
  // 契约：object→object、array→array、void→void，其余（含 string/number/boolean/缺省）→ primitive。
  it("object → object", () => {
    expect(kindOf({ type: "object" })).toBe("object");
  });
  it("array → array", () => {
    expect(kindOf({ type: "array" })).toBe("array");
  });
  it("void → void", () => {
    expect(kindOf({ type: "void" })).toBe("void");
  });
  it("string → primitive", () => {
    expect(kindOf({ type: "string" })).toBe("primitive");
  });
  it("number → primitive", () => {
    expect(kindOf({ type: "number" })).toBe("primitive");
  });
  it("boolean → primitive", () => {
    expect(kindOf({ type: "boolean" })).toBe("primitive");
  });
  it("缺省 type → primitive", () => {
    expect(kindOf({} as IFieldSchema)).toBe("primitive");
  });
});

describe("normalizeComponent", () => {
  // 契约：归一化为 [key, props]；undefined → ["", undefined]；字符串 → [key, undefined]；元组原样拆分。
  it("undefined → ['', undefined]", () => {
    expect(normalizeComponent(undefined)).toEqual(["", undefined]);
  });
  it("null → ['', undefined]", () => {
    expect(normalizeComponent(null as any)).toEqual(["", undefined]);
  });
  it("字符串 → [key, undefined]", () => {
    expect(normalizeComponent("Input")).toEqual(["Input", undefined]);
  });
  it("元组 → [key, props]", () => {
    const props = { placeholder: "x" };
    expect(normalizeComponent(["Input", props])).toEqual(["Input", props]);
  });
});
