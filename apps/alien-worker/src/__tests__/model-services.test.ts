import { describe, expect, it } from "vitest";
import type { AlienSchema } from "@alien-form/protocol";
import { ModelModules } from "../services/model-modules.ts";

function schema(name: string): AlienSchema {
  return {
    name,
    title: name,
    version: 1,
    fields: [],
    form: { type: "object" },
    pages: [],
  };
}

describe("ModelModules", () => {
  it("auto-loads every generated model directory entry", async () => {
    const modules = new ModelModules();
    const definitions = await modules.entries();

    expect(definitions.map((module) => module.schema.name)).toEqual([
      "_sys_model_category",
      "_sys_role",
      "_sys_user",
    ]);
  });

  it("resolves model behavior from its schema name", async () => {
    const module = { schema: schema("article") };
    const modules = ModelModules.from([module]);

    await expect(modules.get("article")).resolves.toBe(module);
    expect(modules.has("article")).toBe(true);
  });

  it("returns undefined for files outside the generated convention", async () => {
    const modules = ModelModules.from([]);

    await expect(modules.get("article")).resolves.toBeUndefined();
  });
});
