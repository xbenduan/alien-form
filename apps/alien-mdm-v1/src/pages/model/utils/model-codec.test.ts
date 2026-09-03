import { describe, expect, it } from "vitest";
import {
  createDefaultPages,
  createModelCopyValues,
  decodeModel,
  encodeModel,
  retargetModelPages,
  syncFieldsFromDatabase,
} from "./model-codec";

const databaseJson = JSON.stringify({
  fields: {
    name: { title: "名称", type: "text" },
  },
});

describe("model codec", () => {
  it("stores database fields separately from definitions.form-schema", () => {
    const model = encodeModel({
      modelCode: "products",
      title: "商品",
      addOpenMode: "modal",
      editOpenMode: "drawer",
      detailOpenMode: "page",
      databaseJson,
      fieldsJson: JSON.stringify({
        name: { type: "string", title: "名称" },
      }),
    });
    expect(model.database.fields).toEqual({
      name: { title: "名称", type: "text" },
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
      databaseJson,
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
      databaseJson,
      fieldsJson: JSON.stringify({ name: { type: "string" } }),
      pagesJson: JSON.stringify(pages),
    });
    expect(model["x-pages"][0]?.title).toBe("商品档案");
  });

  it("creates copy values with a new identity and retargeted pages", () => {
    const model = encodeModel({
      modelCode: "products",
      title: "商品",
      databaseJson: JSON.stringify({
        fields: {
          name: {
            type: "text",
            relation: { kind: "many-to-one", target: "products", labelField: "name" },
          },
        },
      }),
      fieldsJson: JSON.stringify({ name: { type: "string" } }),
    });

    const copy = createModelCopyValues(model);
    const pages = JSON.parse(copy.pagesJson ?? "[]");

    expect(copy.modelCode).toBe("products_copy");
    expect(copy.title).toBe("商品副本");
    expect(JSON.parse(copy.databaseJson).fields.name.relation.target).toBe("products_copy");
    expect(pages[0].schema.properties.table.props.modelCode).toBe("products_copy");
    expect(pages[0].schema.properties.table.props.loadData).toContain('model: "products_copy"');
  });

  it("retargets copied pages again when the draft model code changes", () => {
    const pages = createDefaultPages("products_copy", "商品副本");
    const retargeted = retargetModelPages(pages, "products_copy", "archived_products");

    expect(retargeted[0]?.schema.properties.table?.props?.modelCode).toBe("archived_products");
    expect(retargeted[0]?.schema.properties.table?.props?.loadData).toContain(
      'model: "archived_products"',
    );
  });

  it("stores and restores form groups inside form-schema", () => {
    const model = encodeModel({
      modelCode: "products",
      title: "商品",
      databaseJson: JSON.stringify({
        fields: {
          name: { type: "text" },
          status: { type: "text" },
        },
      }),
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
      databaseJson,
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

  it("rejects expressions and storage declarations in the form schema", () => {
    expect(() =>
      encodeModel({
        modelCode: "products",
        title: "商品",
        databaseJson,
        fieldsJson: JSON.stringify({
          name: { type: "string", default: "{{ $query.name }}" },
        }),
      }),
    ).toThrow("must not contain expressions");
    expect(() =>
      encodeModel({
        modelCode: "products",
        title: "商品",
        databaseJson,
        fieldsJson: JSON.stringify({
          name: { type: "string", "x-database": { type: "text" } },
        }),
      }),
    ).toThrow("不允许包含 x-database");
  });

  it("generates form templates from database fields and preserves UI configuration", () => {
    const fields = syncFieldsFromDatabase(
      {
        fields: {
          name: { title: "名称", type: "text", nullable: false, filterable: true },
          profile: { title: "资料", type: "json", valueType: "object" },
        },
      },
      {
        name: { type: "number", title: "自定义名称", component: "TextArea" },
        removed: { type: "string" },
      },
    );

    expect(fields).toEqual({
      name: {
        type: "string",
        title: "自定义名称",
        component: "TextArea",
        required: true,
        "x-table": { filterable: true },
      },
      profile: {
        type: "object",
        title: "资料",
        component: "ObjectField",
        properties: {},
      },
    });
  });

  it("rejects schema fields that diverge from database fields", () => {
    expect(() =>
      encodeModel({
        modelCode: "products",
        title: "商品",
        databaseJson,
        fieldsJson: JSON.stringify({
          renamed: { type: "string" },
        }),
      }),
    ).toThrow("Schema 缺少数据库字段：name");
  });
});
