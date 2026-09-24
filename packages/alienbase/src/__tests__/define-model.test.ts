import { describe, expect, it } from "vitest";
import type { AlienSchema } from "@alien-form/protocol";
import { defineModel, type ModelDefinition } from "../index.ts";

const schema: AlienSchema = {
  name: "article",
  title: "文章",
  version: 1,
  fields: [],
  form: { type: "object" },
  pages: [],
};

describe("defineModel", () => {
  it("preserves a definition with exactly one selector", () => {
    const definition = { schema, constants: { code: "article" } } as const;

    expect(defineModel(definition)).toBe(definition);
  });

  it("rejects definitions with ambiguous or missing selectors at runtime", () => {
    expect(() => defineModel({ schema, name: "article" } as unknown as ModelDefinition)).toThrow(
      "模型定义必须且只能声明 schema、name 或 match 之一",
    );
    expect(() => defineModel({} as ModelDefinition)).toThrow(
      "模型定义必须且只能声明 schema、name 或 match 之一",
    );
  });
});
