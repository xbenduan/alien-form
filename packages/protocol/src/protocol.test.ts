import { describe, expect, it } from "vitest";
import {
  assertModelSchema,
  assertStorageCompatible,
  parseModelSchema,
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
});
