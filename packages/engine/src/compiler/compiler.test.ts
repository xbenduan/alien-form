import { describe, expect, it } from "vitest";
import { compileForm, compileModel, isCompiledValue, matchPage } from ".";
import type { BuilderSchema } from "../protocol";

const model: BuilderSchema = {
  meta: { name: "products", title: "商品" },
  fields: [{ key: "name", title: "名称", type: "text" }],
  pages: [
    {
      router: "list",
      layout: {
        component: "layout",
        props: { rightBottom: "table" },
      },
      properties: {
        table: {
          type: "void",
          component: "table",
          props: {
            schema: { $ref: "form-schema" },
            filter: "{{ $values.filter }}",
          },
        },
      },
    },
  ],
  definitions: {
    "form-schema": {
      type: "object",
      properties: {
        name: { type: "string", title: "名称" },
      },
      group: [{ component: "ObjectField", title: "基础信息", keys: ["name"] }],
    },
  },
};

describe("page compiler", () => {
  it("resolves static references and precompiles expressions", () => {
    const [page] = compileModel(model);
    const table = page.nodes[0].children[0];
    expect((table.props.schema as { properties: unknown }).properties).toBeDefined();
    expect(isCompiledValue(table.props.filter)).toBe(true);
    expect((table.props.filter as any).expression({ $values: { filter: "ok" } })).toBe("ok");
  });

  it("wraps page layouts without changing value paths", () => {
    const [page] = compileModel(model);
    expect(page.schema.properties?.$page.type).toBe("void");
    expect(page.nodes[0].slots.rightBottom).toBe(page.nodes[0].children[0]);
  });

  it("matches an empty segment to list", () => {
    expect(matchPage(compileModel(model), "")?.router).toBe("list");
  });

  it("projects form groups into void containers without changing field keys", () => {
    const compiled = compileForm(model.definitions["form-schema"], model.definitions);
    expect(compiled.nodes).toHaveLength(1);
    expect(compiled.nodes[0]?.schema).toMatchObject({
      type: "void",
      component: "ObjectField",
      title: "基础信息",
    });
    expect(compiled.nodes[0]?.children.map((child) => child.key)).toEqual(["name"]);
  });

  it("rejects models without the form-schema contract", () => {
    expect(() =>
      compileModel({ ...model, definitions: {} as BuilderSchema["definitions"] }),
    ).toThrow("definitions['form-schema'].properties is required");
  });
});
