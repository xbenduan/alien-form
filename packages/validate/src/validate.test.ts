import { describe, expect, it } from "vitest";
import { assertBuilderSchema, parseBuilderSchema, type BuilderSchema } from "./index";

function model(): BuilderSchema {
  return {
    meta: { name: "orders", title: "订单" },
    fields: [
      { key: "id", title: "ID", type: "text", system: true, filterable: true },
      { key: "amount", title: "金额", type: "real", nullable: false, filterable: true },
    ],
    pages: [
      {
        router: "list",
        properties: {
          table: { type: "void", component: "table", props: { filter: "{{ $values.filter }}" } },
        },
      },
    ],
    definitions: {
      "form-schema": {
        type: "object",
        properties: {
          id: { type: "string", title: "ID", display: "hidden" },
          amount: { type: "number", title: "金额", component: "NumberInput", required: true },
        },
      },
    },
  };
}

describe("BuilderSchema validation", () => {
  it("accepts a valid schema and returns typed value", () => {
    const parsed = parseBuilderSchema(model());
    expect(parsed.meta.name).toBe("orders");
    expect(parsed.fields).toHaveLength(2);
  });

  it("allows expressions in pages but rejects them in form-schema", () => {
    const bad = model();
    (bad.definitions["form-schema"].properties!.amount as Record<string, unknown>).props = {
      x: "{{ $values.id }}",
    };
    expect(() => assertBuilderSchema(bad)).toThrow(/不允许包含表达式/);
  });

  it("rejects form-schema drift from fields", () => {
    const bad = model();
    delete bad.definitions["form-schema"].properties!.amount;
    expect(() => assertBuilderSchema(bad)).toThrow(/缺少数据库字段：amount/);
  });

  it("rejects required mismatch with nullable", () => {
    const bad = model();
    bad.definitions["form-schema"].properties!.amount.required = false;
    expect(() => assertBuilderSchema(bad)).toThrow(/required 与 fields 不一致/);
  });

  it("rejects duplicate field keys", () => {
    const bad = model();
    bad.fields.push({ key: "amount", type: "text" });
    expect(() => assertBuilderSchema(bad)).toThrow(/重复|不一致/);
  });
});
