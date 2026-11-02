import { describe, expect, it } from "vitest";
import {
  assertRuntimeSchema,
  fieldIssues,
  modelDocumentSchema,
  modelIssues,
  viewIssues,
} from "../schema";
import { schemaFieldAt } from "../presentation";
import type { ModelDocument } from "../types";

const document = (): ModelDocument => ({
  id: "catalog",
  title: "目录",
  data: {
    type: "object",
    properties: {
      name: { type: "string" },
      parentId: { type: ["string", "null"] },
      lines: { type: "array", items: { $ref: "#/$defs/line" } },
      "a/b": { type: "string" },
    },
    $defs: { line: { type: "object", properties: { price: { type: "number" } } } },
  },
  tree: { parentField: "/parentId", labelField: "/name" },
  fields: {
    "/name": { order: -1, form: { props: { placeholder: "名称" } }, table: { title: "目录名称" } },
    "/lines/*/price": {
      form: { component: "Money", bindings: { disabled: "{{ !$values.price }}" } },
    },
    "/a~1b": { table: false, filter: false },
  },
  views: { edit: { field: "", children: [{ field: "/name" }, { field: "/lines" }] } },
});

describe("字段展示与值 schema 分层", () => {
  it("接受稀疏展示和 field 简写，复用数组引用并静态校验推导组件", () => {
    const model = modelDocumentSchema.parse(document());
    expect(schemaFieldAt(model.data, "/lines/7/price")).toMatchObject({
      path: "/lines/*/price",
      schema: { type: "number" },
    });
    expect(schemaFieldAt(model.data, "/a~1b").schema).toEqual({ type: "string" });
    expect(
      viewIssues(
        model.views!.edit!,
        model.data,
        ["Object", "Input", "Array", "Money"],
        model.data,
        "",
        model.fields,
      ),
    ).toEqual([]);
    expect(fieldIssues(model.fields, ["Input"])).toMatchObject([
      { code: "UNKNOWN_COMPONENT", path: "/fields/~1lines~1*~1price/form/component" },
    ]);
    expect(viewIssues({ field: "/name" }, model.data, ["Input"])).toEqual([]);
    expect(viewIssues({ field: "/missing" }, model.data, ["Input"])[0]?.code).toBe("UNKNOWN_FIELD");
  });
  it.each([
    ["/missing", { form: { component: "Input" } }, "/fields/~1missing"],
    ["/lines/0/price", { form: {} }, "/fields/~1lines~10~1price"],
    ["/name", { form: { props: { value: "override" } } }, "/fields/~1name/form/props/value"],
    [
      "/name",
      { filter: { bindings: { value: "{{ 1 }}" } } },
      "/fields/~1name/filter/bindings/value",
    ],
    ["/name", { form: { bindings: { visible: "{{ (" } } }, "/fields/~1name/form/bindings/visible"],
    ["/name", { form: false }, "/fields/~1name/form"],
    ["/name", { order: 0.5 }, "/fields/~1name/order"],
  ])("拒绝不可定位或不合法的字段覆盖 %s", (pointer, definition, path) => {
    const model = { ...document(), fields: { [pointer]: definition } };
    expect(modelIssues(model).map((issue) => issue.path)).toContain(path);
  });
  it("纯 JSON 文档拒绝代码 props，Domain 转换保留代码身份", () => {
    const action = () => "名称";
    const model = { ...document(), fields: { "/name": { form: { props: { onFocus: action } } } } };
    expect(modelDocumentSchema.safeParse(model).success).toBe(false);
    expect(assertRuntimeSchema(model).fields?.["/name"]?.form?.props?.onFocus).toBe(action);
  });
  it("树字段必须可定位为独立的根字符串字段，数据约束不接收展示关键字", () => {
    expect(
      modelIssues({
        ...document(),
        tree: { parentField: "/lines/0/price", labelField: "/name" },
      }).map((issue) => issue.path),
    ).toContain("/tree/parentField");
    const model = document();
    Object.assign(model.data.properties.name!, { component: "Input" });
    expect(modelIssues(model).map((issue) => issue.path)).toContain(
      "/data/properties/name/component",
    );
    expect(
      modelIssues({ ...document(), views: { edit: {} } }).map((issue) => issue.path),
    ).toContain("/views/edit/component");
  });
});
