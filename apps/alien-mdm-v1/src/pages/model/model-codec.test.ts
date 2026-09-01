import { describe, expect, it } from "vitest";
import { decodeModel, encodeModel } from "./model-codec";

describe("model codec", () => {
  it("stores fields only in definitions.form-schema", () => {
    const model = encodeModel({
      modelCode: "products",
      title: "商品",
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
