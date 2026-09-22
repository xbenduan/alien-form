import { describe, expect, it } from "vitest";
import {
  assertModelSchema,
  assertStorageCompatible,
  parseModelSchema,
  parsePageSchema,
  type ModelFieldSchema,
  type ModelSchema,
} from "./index.ts";

function model(): ModelSchema {
  const fields: ModelFieldSchema[] = [
    {
      id: "orders.name",
      key: "name",
      type: "string",
      title: "名称",
      required: true,
      storage: { type: "text", index: true },
      form: { component: "Input" },
    },
    {
      id: "orders.remark",
      key: "remark",
      type: "string",
      title: "备注",
      form: { component: "TextArea" },
    },
    {
      id: "orders.id",
      key: "id",
      type: "string",
      title: "ID",
      required: true,
      storage: { type: "text", system: true, unique: true, index: true },
      form: { display: "hidden" },
    },
    {
      id: "orders.createdAt",
      key: "createdAt",
      type: "string",
      title: "创建时间",
      required: true,
      storage: { type: "integer", system: true },
      form: {},
    },
    {
      id: "orders.updatedAt",
      key: "updatedAt",
      type: "string",
      title: "更新时间",
      required: true,
      storage: { type: "integer", system: true },
      form: {},
    },
  ];
  return {
    name: "orders",
    title: "订单",
    version: 0,
    fields,
    form: {
      type: "object",
      properties: {
        base: {
          type: "void",
          component: "Card",
          title: "基础信息",
          properties: {
            name: { $ref: "#/fields/name" },
            remark: { $ref: "#/fields/remark" },
          },
        },
        id: { $ref: "#/fields/id" },
        createdAt: { $ref: "#/fields/createdAt" },
        updatedAt: { $ref: "#/fields/updatedAt" },
      },
    },
    pages: [
      {
        router: "add",
        title: "新建订单",
        permission: "create",
        type: "void",
        component: "record-form",
        props: { schema: { $ref: "form-schema" } },
      },
    ],
  };
}

function parentField(): ModelFieldSchema {
  return {
    id: "orders.parentId",
    key: "parentId",
    type: "string",
    title: "父级订单",
    storage: { type: "text", index: true },
    relation: {
      kind: "many-to-one",
      target: "orders",
      valueField: "id",
      labelField: "name",
    },
    form: { component: "TreeSelect" },
  };
}

describe("ModelSchema", () => {
  it("解析 physical 与 virtual 字段", () => {
    const parsed = parseModelSchema(model());
    expect(parsed.name).toBe("orders");
    expect(parsed.fields[0].storage?.type).toBe("text");
    expect(parsed.fields[1].storage).toBeUndefined();
  });

  it("拒绝字段表现层重复声明根属性", () => {
    const value = model();
    value.fields[0].form = { ...value.fields[0].form, type: "string" };
    expect(() => assertModelSchema(value)).toThrow(/只能声明在字段根部/);
  });

  it("拒绝关联表单重复声明可推导参数", () => {
    const value = model();
    value.fields.unshift({
      ...parentField(),
      form: { component: "TreeSelect", props: { model: "orders" } },
    });
    expect(() => assertModelSchema(value)).toThrow(/由 relation 派生/);
  });

  it("拒绝非 JSON 物理列存储复杂值", () => {
    const value = model();
    value.fields[0] = { ...value.fields[0], type: "array" };
    expect(() => assertModelSchema(value)).toThrow(/只有 json/);
  });

  it("拒绝修改已发布物理字段", () => {
    const current = model();
    const incoming = model();
    incoming.fields[0] = { ...incoming.fields[0], key: "renamed" };
    expect(() => assertStorageCompatible(current, incoming)).toThrow(/key 不允许修改/);
  });

  it("允许自由删除 virtual 字段", () => {
    const current = model();
    const incoming = model();
    incoming.fields = incoming.fields.filter((field) => field.storage);
    expect(() => assertStorageCompatible(current, incoming)).not.toThrow();
  });

  it("只允许自关联字段使用 TreeSelect", () => {
    const valid = model();
    valid.fields.unshift(parentField());
    expect(() => assertModelSchema(valid)).not.toThrow();

    const invalid = model();
    invalid.fields.unshift({
      ...parentField(),
      relation: { ...parentField().relation!, target: "users" },
    });
    expect(() => assertModelSchema(invalid)).toThrow(/仅自关联字段/);
  });

  it("拒绝重复页面路由", () => {
    const value = model();
    value.pages.push({ ...value.pages[0] });
    expect(() => assertModelSchema(value)).toThrow(/router 重复/);
  });

  it("校验根组件、slot 与必填 props", () => {
    expect(() =>
      parsePageSchema({
        router: "list",
        permission: "read",
        type: "void",
        component: "layout",
        slots: { content: { one: { type: "void" }, two: { type: "void" } } },
      }),
    ).not.toThrow();
    expect(() =>
      parsePageSchema({
        router: "list",
        permission: "read",
        type: "void",
        component: "table",
      }),
    ).toThrow(/modelCode 必填/);
    expect(() =>
      parsePageSchema({
        router: "list",
        permission: "read",
        type: "void",
        component: "Unknown",
      }),
    ).toThrow(/未声明的组件能力/);
  });

  it("拒绝组件与字段类型不匹配", () => {
    expect(() =>
      parsePageSchema({
        router: "detail",
        permission: "read",
        type: "void",
        properties: { invalid: { type: "string", component: "Card" } },
      }),
    ).toThrow(/Card 不支持 string 类型/);
  });

  it("校验表达式语法和能力引用", () => {
    const page = (onClick: string) => ({
      router: "list",
      permission: "read",
      type: "void",
      properties: {
        button: { type: "void", component: "Button", props: { onClick } },
      },
    });
    expect(() =>
      parsePageSchema(page('{{ async () => $service("records.list")() }}')),
    ).not.toThrow();
    expect(() => parsePageSchema(page('{{ () => $service("missing")() }}'))).toThrow(
      /服务能力不存在/,
    );
    expect(() => parsePageSchema(page("{{ () => ( }}"))).toThrow(/语法不合法/);
  });

  it("仅在 rowActions slot 中开放页面 $row 上下文", () => {
    const action = {
      type: "void",
      component: "row-button",
      props: { onClick: "{{ () => $utils.message.info($row.id) }}" },
    };
    expect(() =>
      parsePageSchema({
        router: "list",
        permission: "read",
        type: "void",
        properties: { action },
      }),
    ).toThrow(/\$row/);
    expect(() =>
      parsePageSchema({
        router: "list",
        permission: "read",
        type: "void",
        component: "table",
        props: {
          modelCode: "orders",
          schema: {},
          columns: [],
          loadData: '{{ $service("records.list") }}',
        },
        slots: { rowActions: { action } },
      }),
    ).not.toThrow();
  });
});
