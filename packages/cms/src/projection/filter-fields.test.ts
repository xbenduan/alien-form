import { describe, expect, it } from "vitest";
import { projectFilterFields } from "./filter-fields";
import type { AdapterCatalogItem } from "../define/adapters";

describe("projectFilterFields", () => {
  it('skips fields with display: "none"', () => {
    const result = projectFilterFields({
      properties: {
        visibleField: {
          title: "Visible Field",
          component: "Input",
        },
        hiddenField: {
          title: "Hidden Field",
          component: "Input",
          display: "none",
        },
      },
    });

    expect(result).toEqual([
      expect.objectContaining({
        key: "visibleField",
        title: "Visible Field",
      }),
    ]);
  });

  it("flattens nested leaf fields with a $root.<path> key", () => {
    const result = projectFilterFields({
      properties: {
        address: {
          type: "object",
          properties: {
            city: { title: "城市", component: "Input" },
          },
        },
      },
    });

    expect(result).toEqual([
      expect.objectContaining({
        key: "$root.address.city",
        path: "address.city",
        title: "城市",
      }),
    ]);
  });

  it("turns the title into a 请输入${title} placeholder", () => {
    const [field] = projectFilterFields({
      properties: {
        name: { title: "名称", component: "Input" },
      },
    });

    expect(field.props?.placeholder).toBe("请输入名称");
  });

  it("excludes system fields and fields disabled via x-cms.filter.visible", () => {
    const result = projectFilterFields({
      properties: {
        id: { title: "ID", component: "Input" },
        createdAt: { title: "创建时间", component: "DateInput" },
        secret: {
          title: "Secret",
          component: "Input",
          "x-cms": { filter: { visible: false } },
        },
        name: { title: "名称", component: "Input" },
      },
    });

    expect(result.map((field) => field.key)).toEqual(["name"]);
  });

  it("derives the operator default from the resolver variant when a catalog is provided", () => {
    const catalog: AdapterCatalogItem[] = [
      {
        name: "Select",
        key: "Select",
        label: "Select",
        description: "Select adapter",
        kind: "component",
        scenes: {
          filter: { mode: "filter", operator: "in" },
        },
        meta: {},
        params: [],
      },
    ];

    const [field] = projectFilterFields(
      {
        properties: {
          status: { title: "状态", component: "Select" },
        },
      },
      catalog,
    );

    expect(field.operator).toBe("in");
  });
});
