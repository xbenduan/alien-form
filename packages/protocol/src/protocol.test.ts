import { describe, expect, it } from "vitest";
import {
  assertModelSchema,
  assertStorageCompatible,
  parsePageSchema,
  parseModelSchema,
  type ModelFieldSchema,
  type ModelSchema,
} from "./index.ts";

function model(): ModelSchema {
  return {
    name: "orders",
    title: "订单",
    version: 0,
    fields: [
      {
        id: "orders.name",
        key: "name",
        storage: "physical",
        database: { type: "text", nullable: false, index: true },
        form: { type: "string", title: "名称", component: "Input", required: true },
      },
      {
        id: "orders.remark",
        key: "remark",
        storage: "virtual",
        form: { type: "string", title: "备注", component: "TextArea" },
      },
      {
        id: "orders.id",
        key: "id",
        storage: "physical",
        database: { type: "text", system: true, nullable: false, unique: true, index: true },
        form: { type: "string", title: "ID", display: "hidden" },
      },
      {
        id: "orders.createdAt",
        key: "createdAt",
        storage: "physical",
        database: { type: "integer", valueType: "string", system: true, nullable: false },
        form: { type: "string", title: "创建时间" },
      },
      {
        id: "orders.updatedAt",
        key: "updatedAt",
        storage: "physical",
        database: { type: "integer", valueType: "string", system: true, nullable: false },
        form: { type: "string", title: "更新时间" },
      },
    ],
    pages: [
      {
        router: "add",
        permission: "create",
        groups: [{ title: "基础信息", keys: ["name", "remark"] }],
        properties: {
          form: {
            type: "void",
            component: "record-form",
            props: { schema: { $ref: "form-schema" } },
          },
        },
      },
    ],
  };
}

/** 创建用于验证树形自关联组件的父级字段。 */
function parentField(): ModelFieldSchema {
  return {
    id: "orders.parentId",
    key: "parentId",
    storage: "physical",
    database: { type: "text", nullable: true, index: true },
    relation: {
      kind: "many-to-one",
      target: "orders",
      valueField: "id",
      labelField: "name",
    },
    form: {
      type: "string",
      title: "父级订单",
      component: "TreeSelect",
      props: {
        model: "orders",
        parentField: "parentId",
        valueField: "id",
        labelField: "name",
        loadData: '{{ $utils.tree($service("records.subtree")) }}',
      },
    },
  };
}

describe("ModelSchema", () => {
  it("解析 physical 与 virtual 字段", () => {
    const parsed = parseModelSchema(model());
    expect(parsed.name).toBe("orders");
    expect(parsed.fields[1].storage).toBe("virtual");
  });

  it("拒绝后端持久化 form-schema", () => {
    expect(() =>
      assertModelSchema({
        ...model(),
        definitions: { "form-schema": { type: "object" } },
      }),
    ).toThrow(/form-schema/);
  });

  it("拒绝 virtual 字段配置 database", () => {
    const value = model();
    value.fields[1] = {
      ...value.fields[1],
      database: { type: "text" },
    };
    expect(() => assertModelSchema(value)).toThrow(/virtual/);
  });

  it("拒绝页面分组引用未知字段", () => {
    const value = model();
    value.pages[0].groups = [{ keys: ["missing"] }];
    expect(() => assertModelSchema(value)).toThrow(/不存在的字段/);
  });

  it("拒绝修改已发布物理字段", () => {
    const current = model();
    const incoming = model();
    incoming.fields[0] = {
      ...incoming.fields[0],
      key: "renamed",
    };
    expect(() => assertStorageCompatible(current, incoming)).toThrow(/key 不允许修改/);
  });

  it("允许自由删除 virtual 字段", () => {
    const current = model();
    const incoming = model();
    incoming.fields = incoming.fields.filter((field) => field.storage === "physical");
    expect(() => assertStorageCompatible(current, incoming)).not.toThrow();
  });

  it("允许自关联父级字段使用 TreeSelect", () => {
    const value = model();
    value.fields.unshift(parentField());
    expect(() => assertModelSchema(value)).not.toThrow();
  });

  it("拒绝非自关联字段使用 TreeSelect", () => {
    const value = model();
    const field = parentField();
    field.relation = { ...field.relation!, target: "users" };
    field.form.props = { ...field.form.props, model: "users" };
    value.fields.unshift(field);
    expect(() => assertModelSchema(value)).toThrow(/仅自关联字段/);
  });

  it("拒绝重复页面路由", () => {
    const value = model();
    value.pages.push({ ...value.pages[0], properties: { ...value.pages[0].properties } });
    expect(() => assertModelSchema(value)).toThrow(/router 重复/);
  });

  it("校验组件、slot 与必填 props", () => {
    expect(() =>
      parsePageSchema({
        router: "list",
        permission: "read",
        layout: { component: "layout", slots: { content: "missing" } },
        properties: {},
      }),
    ).toThrow(/不存在的节点/);
    expect(() =>
      parsePageSchema({
        router: "list",
        permission: "read",
        properties: { table: { type: "void", component: "table", props: {} } },
      }),
    ).toThrow(/modelCode 必填/);
    expect(() =>
      parsePageSchema({
        router: "list",
        permission: "read",
        properties: { unknown: { type: "void", component: "Unknown" } },
      }),
    ).toThrow(/未声明的组件能力/);
  });

  it("拒绝组件与字段类型不匹配", () => {
    expect(() =>
      parsePageSchema({
        router: "detail",
        permission: "read",
        properties: {
          invalid: { type: "string", component: "Card" },
        },
      }),
    ).toThrow(/Card 不支持 string 类型/);
    expect(() =>
      parsePageSchema({
        router: "detail",
        permission: "read",
        properties: {
          invalid: { type: "array", component: "Card" },
        },
      }),
    ).toThrow(/仅支持包含 items 的复杂数组/);
  });

  it("校验表达式语法和能力引用", () => {
    expect(() =>
      parsePageSchema({
        router: "list",
        permission: "read",
        properties: {
          button: {
            type: "void",
            component: "Button",
            props: { onClick: '{{ async () => $service("records.list")() }}' },
          },
        },
      }),
    ).not.toThrow();
    expect(() =>
      parsePageSchema({
        router: "list",
        permission: "read",
        properties: {
          button: {
            type: "void",
            component: "Button",
            props: { onClick: '{{ () => $service("missing")() }}' },
          },
        },
      }),
    ).toThrow(/服务能力不存在/);
    expect(() =>
      parsePageSchema({
        router: "list",
        permission: "read",
        properties: {
          button: {
            type: "void",
            component: "Button",
            props: { onClick: "{{ () => ( }}" },
          },
        },
      }),
    ).toThrow(/语法不合法/);
  });

  it("仅在 rowActions slot 中开放页面 $row 上下文", () => {
    const action = {
      type: "void",
      component: "row-button",
      props: {
        onClick: "{{ () => $utils.message.info($row.id) }}",
      },
    };
    expect(() =>
      parsePageSchema({
        router: "list",
        permission: "read",
        properties: { action },
      }),
    ).toThrow(/\$row/);
    expect(() =>
      parsePageSchema({
        router: "list",
        permission: "read",
        properties: {
          table: {
            type: "void",
            component: "table",
            props: {
              modelCode: "orders",
              schema: {},
              columns: [],
              loadData: '{{ $service("records.list") }}',
            },
            slots: { rowActions: ["action"] },
            properties: { action },
          },
        },
      }),
    ).not.toThrow();
  });
});
