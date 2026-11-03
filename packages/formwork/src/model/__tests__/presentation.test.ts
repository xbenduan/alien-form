import { describe, expect, it } from "vitest";
import { assertRuntimeSchema, fieldIssues, modelDocumentSchema, modelIssues } from "../schema";
import { resolveField, resolveModel } from "../field";
import type { ModelDocument } from "../types";

const document = (): ModelDocument => ({
  schemaVersion: 1,
  id: "catalog",
  title: "目录",
  data: {
    name: { type: "string", props: { placeholder: "名称" } },
    parentId: { type: "string", nullable: true },
    lines: { type: "array", items: { $ref: "#/$defs/line" } },
    "a/b": { type: "string", ui: { table: false, filter: false } },
  },
  $defs: {
    line: {
      type: "object",
      properties: { price: { type: "number", ui: { form: { component: "Money" } } } },
    },
  },
  tree: { parentField: "/parentId", labelField: "/name" },
});

describe("共享字段与代码布局", () => {
  it("复用数组引用并检查推导与显式组件，保留 escaped 字段地址", () => {
    const schema = modelDocumentSchema.parse(document());
    const model = resolveModel(schema);
    expect(model.field("/lines/7/price")).toMatchObject({
      path: "/lines/*/price",
      schema: { type: "number" },
    });
    expect(model.field("/a~1b").schema.type).toBe("string");
    expect(() => model.field("/missing")).toThrow();
    const components = ["Input", "ArrayFields", "ObjectFields", "NumberInput", "Money"];
    expect(fieldIssues(schema, components)).toEqual([]);
    expect(
      fieldIssues(
        schema,
        components.filter((name) => name !== "Money"),
      ),
    ).toMatchObject([{ code: "UNKNOWN_COMPONENT", path: "/data/lines/*/price" }]);
  });
  it.each([
    { props: { value: "override" } },
    { props: { scene: "table" } },
    { ui: { form: { props: { value: "受控值" } } } },
    { ui: { filter: { bindings: { value: "{{ 1 }}" } } } },
    { ui: { form: { visible: true } } },
    { order: 0.5 },
    { component: "Input" },
  ])("拒绝受控属性和旧展示语法 %j", (override) => {
    const schema = document();
    Object.assign(schema.data.name!, override);
    expect(modelIssues(schema).length).toBeGreaterThan(0);
  });
  it("代码 props 从调用处传入，组件映射由 app 显式提供", () => {
    const schema = document();
    const field = resolveModel(schema).field("/lines/0/price");
    const onFocus = () => "price";
    expect(resolveField(field, { scene: "form", props: { onFocus } })).toMatchObject({
      component: "Money",
      props: { onFocus },
    });
    expect(() => resolveField(field, { scene: "table" })).toThrow("缺少 table 组件映射");
    expect(resolveField(field, { scene: "table", component: "NumberInput" }).component).toBe(
      "NumberInput",
    );
    expect(resolveField(field, { scene: "form", component: "Explicit" }).component).toBe(
      "Explicit",
    );
    expect(() =>
      assertRuntimeSchema({
        ...schema,
        data: { name: { type: "string", props: { onFocus } } },
      }),
    ).toThrow();
  });
  it("树字段保持根字符串语义，布局由 Domain 代码承载", () => {
    expect(
      modelIssues({
        ...document(),
        tree: { parentField: "/lines/0/price", labelField: "/name" },
      }).map((issue) => issue.path),
    ).toContain("/tree/parentField");
    for (const key of ["views", "pages", "fields", "layout"])
      expect(modelIssues({ ...document(), [key]: {} })).toContainEqual(
        expect.objectContaining({ path: `/${key}`, code: "INVALID_MODEL" }),
      );
  });
});
