import { describe, expect, it } from "vitest";
import type { AlienSchema } from "@alien-form/protocol";
import { defineModel } from "@alien-form/alienbase";
import { ModelModules } from "../application/model-modules.ts";
import { createCore } from "../bootstrap/core.ts";

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
  it("loads every model declared by the Core definition", async () => {
    const modules = new ModelModules(createCore.models);
    const schemas = await modules.list();

    expect(schemas.map(({ name }) => name)).toEqual([
      "_sys_model_category",
      "_sys_role",
      "_sys_user",
    ]);
    expect(
      Object.fromEntries(
        schemas.map((schema) => [
          schema.name,
          schema.fields
            .filter((field) => field.storage && field.relation?.kind !== "many-to-many")
            .map((field) => field.key),
        ]),
      ),
    ).toEqual({
      _sys_model_category: ["id", "code", "name", "order", "aggregate", "createdAt", "updatedAt"],
      _sys_role: ["id", "code", "name", "parentId", "createdAt", "updatedAt"],
      _sys_user: ["id", "username", "passwordHash", "createdAt", "updatedAt"],
    });
  });

  it("matches batch behavior before exact model behavior", async () => {
    const batch = defineModel({
      match: ({ schema }) => schema.group === "cms",
      middleware: { validate() {} },
    });
    const exact = defineModel({
      name: "article",
      middleware: { validate() {} },
    });
    const code = defineModel({ schema: schema("_sys_article") });
    const modules = ModelModules.from([exact, code, batch]);
    const article = { ...schema("article"), group: "cms" };

    await expect(modules.matching(article)).resolves.toEqual([batch, exact]);
    await expect(modules.matching(code.schema)).resolves.toEqual([code]);
  });

  it("only treats definitions carrying schema as code-owned models", async () => {
    const modules = ModelModules.from([
      defineModel({ name: "article" }),
      defineModel({ match: ({ schema }) => schema.group === "cms" }),
      defineModel({ schema: schema("_sys_article") }),
    ]);

    await expect(modules.has("article")).resolves.toBe(false);
    await expect(modules.has("_sys_article")).resolves.toBe(true);
    await expect(modules.schema("article")).resolves.toBeUndefined();
  });
});
