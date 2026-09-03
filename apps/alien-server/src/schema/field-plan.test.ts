import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planFields, refFields } from "./field-plan.ts";
import { assertModelSchema, type ModelSchema } from "./types.ts";

function model(): ModelSchema {
  return {
    meta: { name: "orders", title: "订单" },
    database: {
      fields: {
        amount: {
          title: "金额",
          type: "real",
          nullable: false,
          index: true,
          filterable: true,
        },
        customerId: {
          title: "客户",
          type: "text",
          relation: {
            kind: "many-to-one",
            target: "customers",
            labelField: "name",
          },
        },
      },
    },
    "x-pages": [],
    definitions: {
      "form-schema": {
        type: "object",
        properties: {
          amount: {
            type: "number",
            title: "成交金额",
            component: "Input",
            required: true,
          },
          customerId: {
            type: "string",
            title: "客户",
            component: "Select",
          },
        },
      },
    },
  };
}

describe("database field plan", () => {
  it("builds storage plans exclusively from database.fields", () => {
    const schema = model();
    assertModelSchema(schema);

    const amount = planFields(schema).find((plan) => plan.field === "amount");
    assert.deepEqual(amount, {
      kind: "column",
      field: "amount",
      column: "amount",
      type: "real",
      nullable: false,
      default: undefined,
      unique: false,
      index: true,
      json: false,
      filterable: true,
      sortable: true,
      relationTarget: undefined,
    });

    schema.definitions["form-schema"].properties!.amount.component = "TextArea";
    assert.equal(planFields(schema).find((plan) => plan.field === "amount")?.kind, "column");
    assert.equal(
      (planFields(schema).find((plan) => plan.field === "amount") as { type: string }).type,
      "real",
    );
  });

  it("derives references only from database relation metadata", () => {
    assert.deepEqual(refFields(model()), [
      {
        field: "customerId",
        model: "customers",
        valueKey: "id",
        labelKey: "name",
        multi: false,
      },
    ]);
  });

  it("rejects structural drift between database and form schema", () => {
    const schema = model();
    delete schema.definitions["form-schema"].properties!.amount;
    assert.throws(() => assertModelSchema(schema), /缺少数据库字段：amount/);
  });
});
