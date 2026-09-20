import { describe, expect, it } from "vitest";
import type { ArrayFieldNode, IFormSchema, RowNode } from "../types";
import { createForm } from "../form";
import { InstanceStore } from "../instance-store";

/** Builds the repeated-row schema used by architecture regression tests. */
function arraySchema(): IFormSchema {
  return {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
        },
      },
    },
  };
}

describe("normalized form architecture", () => {
  it("shares one compiled schema descriptor across repeated row instances", () => {
    const form = createForm({
      schema: arraySchema(),
      initialValues: { items: [{ name: "a" }, { name: "b" }] },
    });
    const items = form.field("items") as ArrayFieldNode;
    const first = items.rows()[0].children.get("name")!;
    const second = items.rows()[1].children.get("name")!;

    expect(first).not.toBe(second);
    expect(first.schema).toBe(second.schema);
    expect(first.schema).toBe(
      (items.schema.items as { properties: Record<string, unknown> }).properties.name,
    );
  });

  it("builds one computed O(1) index table for large row collections", () => {
    const store = new InstanceStore();
    const array = { id: "items" } as ArrayFieldNode;
    const state = store.createArray(array);
    const rows = Array.from({ length: 2_000 }, (_, index) => {
      const row = { id: `row_${index}`, parent: array } as RowNode;
      store.registerRow(row, index);
      return row;
    });

    state.rowIds(rows.map((row) => row.id));

    expect(state.indexById().size).toBe(2_000);
    expect(store.rowIndex(rows[1_999])).toBe(1_999);
  });
});
