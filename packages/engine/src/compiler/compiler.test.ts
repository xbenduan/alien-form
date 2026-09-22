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

/** Creates the minimal form API required by compiled expression tests. */
function expressionForm(values: Record<string, unknown>) {
  return {
    getFieldValue(path: string | readonly (string | number)[]) {
      return values[typeof path === "string" ? path : path.join(".")];
    },
  };
}

const model: ModelSchema = {
  name: "products",
  title: "商品",
  version: 1,
  fields: [
    {
      id: "products.name",
      key: "name",
      type: "string",
      title: "名称",
      storage: { type: "text" },
      form: {},
    },
  ],
  form: {
    type: "object",
    properties: {
      base: {
        type: "void",
        component: "Card",
        title: "基础信息",
        properties: { name: { $ref: "#/fields/name" } },
      },
    },
  },
  pages: [
    {
      router: "list",
      permission: "read",
      type: "void",
      component: "layout",
      slots: {
        content: {
          table: {
            type: "void",
            component: "table",
            props: {
              modelCode: "products",
              schema: { $ref: "form-schema" },
              columns: "{{ $utils.schemaToColumns }}",
              filter: '{{ $form.getFieldValue("filter") }}',
              loadData: '{{ $service("records.list") }}',
            },
            slots: {
              rowActions: {
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
              },
            },
            properties: {
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
    },
  ],
};

describe("page compiler", () => {
  it("resolves static references and precompiles expressions", () => {
    const [page] = compileModel(model);
    const table = page.root.children[0];
    expect((table.props.schema as { properties: unknown }).properties).toBeDefined();
    expect(isCompiledValue(table.props.filter)).toBe(true);
    expect(
      (table.props.filter as any).expression({
        $form: expressionForm({ filter: "ok" }),
      }),
    ).toBe("ok");
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
    const table = page.root.children[0];
    const resolved = evaluateCompiledValue(
      {
        filter: table.props.filter,
        nested: [table.children.find((node) => node.key === "delete")?.props.onClick],
        raw: '{{ $form.getFieldValue("filter") }}',
      },
      {
        $form: expressionForm({ filter: "active" }),
        $service: () => (context: unknown) => context,
      },
    );

    expect(resolved.filter).toBe("active");
    expect(typeof resolved.nested[0]).toBe("function");
    expect(resolved.raw).toBe('{{ $form.getFieldValue("filter") }}');
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
    const table = page.root.children[0];
    const rowActions = table.slots.rowActions;

    expect(Array.isArray(rowActions)).toBe(true);
    expect((rowActions as Array<{ key: string }>).map((node) => node.key)).toEqual([
      "deactivate",
      "delete",
    ]);
    expect(table.children.map((node) => node.key)).toEqual([
      "import",
      "export",
      "deactivate",
      "delete",
    ]);
    expect(
      table.children
        .filter((node) => !(rowActions as Array<{ key: string }>).includes(node))
        .map((node) => node.key),
    ).toEqual(["import", "export"]);
  });

  it("compiles the page itself as the root node", () => {
    const [page] = compileModel(model);
    expect(page.schema.properties?.table.type).toBe("void");
    expect(page.root.slots.content).toBe(page.root.children[0]);
  });

  it("matches an empty segment to list", () => {
    expect(matchPage(compileModel(model), "")?.router).toBe("list");
  });

  it("projects form groups into void containers without changing field keys", () => {
    const schema = buildFormSchema(model);
    const compiled = compileForm(schema, buildRuntimeDefinitions(model));
    expect(compiled.nodes).toHaveLength(1);
    expect(compiled.nodes[0]?.schema).toMatchObject({
      type: "void",
      component: "Card",
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
          display: "{{ $form.getFieldValue('enabled') ? 'visible' : 'hidden' }}",
        },
      })),
    };
    const schema = buildFormSchema(dynamicModel);
    const compiled = compileForm(schema, buildRuntimeDefinitions(dynamicModel));
    expect(compiled.schema.properties?.base?.properties?.name).toMatchObject({
      display: "visible",
      "x-reaction": {
        display: "{{ $form.getFieldValue('enabled') ? 'visible' : 'hidden' }}",
      },
    });
  });

  it("derives form-schema from fields", () => {
    expect(buildRuntimeDefinitions(model)["fields/name"]).toMatchObject({
      type: "string",
      title: "名称",
    });
  });
});
