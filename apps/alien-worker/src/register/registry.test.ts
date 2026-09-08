import { describe, expect, it } from "vitest";
import { ModelRegistry } from "./registry.ts";

describe("ModelRegistry", () => {
  it("拒绝重复注册同名模型", () => {
    const registry = new ModelRegistry();
    registry.model("article", {});

    expect(() => registry.model("article", {})).toThrow("模型重复注册：article");
  });

  it("冻结后拒绝新增注册", () => {
    const registry = new ModelRegistry();
    registry.freeze();

    expect(() => registry.model("article", {})).toThrow("ModelRegistry 已冻结");
  });
});
