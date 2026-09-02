import { describe, expect, it } from "vitest";
import { createDefaultPages, decodeModel, encodeModel } from "./model-codec";

describe("model codec", () => {
  it("stores fields only in definitions.form-schema", () => {
    const model = encodeModel({
      modelCode: "products",
      title: "商品",
      addOpenMode: "modal",
      editOpenMode: "drawer",
      detailOpenMode: "page",
      fieldsJson: JSON.stringify({
        name: { type: "string", title: "名称" },
      }),
    });
    expect(model.definitions["form-schema"].properties).toEqual({
      name: { type: "string", title: "名称" },
    });
    expect(model["x-pages"]).toHaveLength(4);
    expect(JSON.stringify(model["x-pages"])).toContain('"$ref":"form-schema"');
    expect(model["x-pages"][0]?.schema.properties.table?.props?.modelCode).toBe("products");
    expect(model.meta.openMode).toEqual({
      add: "modal",
      edit: "drawer",
      detail: "page",
    });
  });

  it("round-trips editor values", () => {
    const model = encodeModel({
      modelCode: "products",
      title: "商品",
      description: "目录",
      fieldsJson: JSON.stringify({ name: { type: "string" } }),
    });
    expect(decodeModel(model)).toMatchObject({
      modelCode: "products",
      title: "商品",
      description: "目录",
    });
    expect(JSON.parse(decodeModel(model).pagesJson ?? "[]")).toHaveLength(4);
  });

  it("stores the page builder JSON as x-pages", () => {
    const pages = createDefaultPages("products", "商品");
    pages[0]!.title = "商品档案";
    const model = encodeModel({
      modelCode: "products",
      title: "商品",
      fieldsJson: JSON.stringify({ name: { type: "string" } }),
      pagesJson: JSON.stringify(pages),
    });
    expect(model["x-pages"][0]?.title).toBe("商品档案");
  });

  it("stores and restores form groups inside form-schema", () => {
    const model = encodeModel({
      modelCode: "products",
      title: "商品",
      fieldsJson: JSON.stringify({
        name: { type: "string" },
        status: { type: "string" },
      }),
      groupsJson: JSON.stringify([
        {
          component: "ObjectField",
          title: "基础信息",
          keys: ["name", "status"],
        },
      ]),
    });
    expect(model.definitions["form-schema"].group).toEqual([
      {
        component: "ObjectField",
        title: "基础信息",
        keys: ["name", "status"],
      },
    ]);
    expect(JSON.parse(decodeModel(model).groupsJson ?? "[]")).toHaveLength(1);
  });

  it("rejects unknown and duplicate grouped fields", () => {
    const values = {
      modelCode: "products",
      title: "商品",
      fieldsJson: JSON.stringify({ name: { type: "string" } }),
    };
    expect(() =>
      encodeModel({
        ...values,
        groupsJson: JSON.stringify([{ keys: ["missing"] }]),
      }),
    ).toThrow("分组字段不存在：missing");
    expect(() =>
      encodeModel({
        ...values,
        groupsJson: JSON.stringify([{ keys: ["name"] }, { keys: ["name"] }]),
      }),
    ).toThrow("字段不能重复分组：name");
  });

  it("rejects expressions in the database schema", () => {
    expect(() =>
      encodeModel({
        modelCode: "products",
        title: "商品",
        fieldsJson: JSON.stringify({
          name: { type: "string", default: "{{ $query.name }}" },
        }),
      }),
    ).toThrow("must not contain expressions");
  });
});
