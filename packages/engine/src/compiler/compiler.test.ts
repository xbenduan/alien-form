import { describe, expect, it } from "vitest";
import {
  buildFormSchema,
  buildRuntimeDefinitions,
  compileForm,
  compileModel,
  compileRuntimeValue,
  containsCompiledValue,
  evaluateCompiledValue,
  isCompiledValue,
  matchPage,
} from ".";
import type { ModelSchema } from "../protocol";

const model: ModelSchema = {
  name: "products",
  title: "商品",
  version: 1,
  fields: [
    {
      id: "products.name",
      key: "name",
      storage: "physical",
      database: { type: "text" },
      form: { type: "string", title: "名称" },
    },
  ],
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
            actionBtns: {
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
                  '{{ ($row) => $service("records.delete")({ model: "products", id: $row.id }) }}',
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
      $service: () => service,
    });
    expect(onClick({ id: "product-1" })).toEqual({ model: "products", id: "product-1" });
  });

  it("evaluates compiled values recursively without interpreting raw strings", () => {
    const [page] = compileModel(model);
    const table = page.nodes[0].children[0];
    const resolved = evaluateCompiledValue(
      {
        filter: table.props.filter,
        nested: [table.children.find((node) => node.key === "delete")?.props.onClick],
        raw: "{{ $values.filter }}",
      },
      {
        $values: { filter: "active" },
        $service: () => (context: unknown) => context,
      },
    );

    expect(resolved.filter).toBe("active");
    expect(typeof resolved.nested[0]).toBe("function");
    expect(resolved.raw).toBe("{{ $values.filter }}");
  });

  it("does not confuse protocol objects with compiled values", () => {
    const protocolValue = { expression: "literal" };
    expect(isCompiledValue(protocolValue)).toBe(false);
    expect(evaluateCompiledValue(protocolValue, {})).toEqual(protocolValue);
  });

  it("compiles standalone protocol props before runtime rendering", () => {
    const date = new Date(0);
    const compiled = compileRuntimeValue({
      options: ["static", "{{ $enums.status }}"],
      onClick: '{{ () => $service("records.list")() }}',
      date,
    });
    expect(containsCompiledValue(compiled)).toBe(true);
    const list = () => "loaded";
    const resolved = evaluateCompiledValue(compiled, {
      $enums: { status: ["enabled"] },
      $service: () => list,
    });

    expect(resolved.options).toEqual(["static", ["enabled"]]);
    expect((resolved.onClick as unknown as () => string)()).toBe("loaded");
    expect(resolved.date).toBe(date);
    expect(containsCompiledValue(resolved)).toBe(false);
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
    const groups = [{ component: "ObjectField", title: "基础信息", keys: ["name"] }];
    const schema = buildFormSchema(model, groups);
    const compiled = compileForm(schema, buildRuntimeDefinitions(model, groups));
    expect(compiled.nodes).toHaveLength(1);
    expect(compiled.nodes[0]?.schema).toMatchObject({
      type: "void",
      component: "ObjectField",
      title: "基础信息",
    });
    expect(compiled.nodes[0]?.children.map((child) => child.key)).toEqual(["name"]);
  });

  it("compiles expression display into a reactive display rule", () => {
    const dynamicModel: ModelSchema = {
      ...model,
      fields: model.fields.map((field) => ({
        ...field,
        form: {
          ...field.form,
          display: "{{ $values.enabled ? 'visible' : 'hidden' }}",
        },
      })),
    };
    const groups = [{ component: "ObjectField", title: "基础信息", keys: ["name"] }];
    const schema = buildFormSchema(dynamicModel, groups);
    const compiled = compileForm(schema, buildRuntimeDefinitions(dynamicModel, groups));
    expect(compiled.schema.properties?.["$group-0"]?.properties?.name).toMatchObject({
      display: "visible",
      "x-reaction": {
        display: "{{ $values.enabled ? 'visible' : 'hidden' }}",
      },
    });
  });

  it("derives form-schema from fields", () => {
    expect(buildRuntimeDefinitions(model)["form-schema"].properties?.name).toEqual(
      model.fields[0].form,
    );
  });
});
