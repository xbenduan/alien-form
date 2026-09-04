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
            rowActions: ["deactivate", "delete"],
            "action-btns": {
              edit: { children: "编辑" },
            },
          },
          properties: {
            deactivate: {
              type: "void",
              component: "row-button",
              props: { children: "停用" },
            },
            delete: {
              type: "void",
              component: "row-button",
              props: {
                children: "删除",
                onClick:
                  "{{ ($row) => $service.records.delete({ model: 'products', id: $row.id }) }}",
              },
            },
            import: {
              type: "void",
              component: "Button",
              props: { children: "导入" },
            },
            export: {
              type: "void",
              component: "Button",
              props: { children: "导出" },
            },
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
    const deleteOnClick = table.children.find((node) => node.key === "delete")?.props.onClick;
    const service = (context: unknown) => context;
    expect(isCompiledValue(deleteOnClick)).toBe(true);
    const onClick = (deleteOnClick as any).expression({
      $service: { records: { delete: service } },
    });
    expect(onClick({ id: "product-1" })).toEqual({ model: "products", id: "product-1" });
  });

  it("extracts row actions and keeps remaining table properties as ordered children", () => {
    const [page] = compileModel(model);
    const table = page.nodes[0].children[0];
    const rowActions = table.slots.rowActions;

    expect(Array.isArray(rowActions)).toBe(true);
    expect((rowActions as Array<{ key: string }>).map((node) => node.key)).toEqual([
      "deactivate",
      "delete",
    ]);
    expect(table.children.map((node) => node.key)).toEqual([
      "deactivate",
      "delete",
      "import",
      "export",
    ]);
    expect(
      table.children
        .filter((node) => !(rowActions as Array<{ key: string }>).includes(node))
        .map((node) => node.key),
    ).toEqual(["import", "export"]);
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

  it("compiles expression display into a reactive display rule", () => {
    const dynamicModel: BuilderSchema = {
      ...model,
      definitions: {
        "form-schema": {
          ...model.definitions["form-schema"],
          properties: {
            name: {
              type: "string",
              title: "名称",
              display: "{{ $values.enabled ? 'visible' : 'hidden' }}",
            },
          },
        },
      },
    };
    const compiled = compileForm(dynamicModel.definitions["form-schema"], dynamicModel.definitions);
    expect(compiled.schema.properties?.["$group-0"].properties?.name).toMatchObject({
      display: "visible",
      "x-reaction": {
        display: "{{ $values.enabled ? 'visible' : 'hidden' }}",
      },
    });
  });

  it("rejects models without the form-schema contract", () => {
    expect(() =>
      compileModel({ ...model, definitions: {} as BuilderSchema["definitions"] }),
    ).toThrow("definitions['form-schema'].properties is required");
  });
});
