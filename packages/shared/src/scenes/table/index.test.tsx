import { describe, expect, it } from "vitest";
import type { TableColumnProjection } from "../../types";
import { buildArraySummary, buildObjectSummary } from "./index";

function createColumn(overrides: Partial<TableColumnProjection> = {}): TableColumnProjection {
  return {
    key: "profile",
    title: "Profile",
    order: 0,
    type: "object",
    field: {
      type: "object",
      properties: {
        name: { type: "string" },
        status: { type: "string" },
      },
    },
    ...overrides,
  };
}

describe("table summaries", () => {
  it("uses explicit inline projection for object values", () => {
    const column = createColumn({
      inline: [
        {
          key: "status",
          dataSource: [{ label: "Active", value: "active" }],
        },
        { key: "name" },
      ],
    });

    expect(buildObjectSummary(column, { name: "Ada", status: "active" }, {})).toBe("Active · Ada");
  });

  it("uses the whole record for layout projections", () => {
    const column = createColumn({
      field: {
        "x-layout": "GridLayout",
        properties: { name: { type: "string" } },
      },
      inline: [{ key: "name" }],
    });

    expect(buildObjectSummary(column, undefined, { name: "Ada" })).toBe("Ada");
  });

  it("summarizes arrays of objects with explicit inline fields", () => {
    const column = createColumn({
      type: "array",
      field: {
        type: "array",
        items: {
          type: "object",
          properties: { name: { type: "string" } },
        },
      },
      inline: [{ key: "name" }],
    });

    expect(buildArraySummary(column, [{ name: "Ada" }, { name: "Lin" }, { name: "Grace" }])).toBe(
      "Ada / Lin +1",
    );
  });

  it("handles empty and mixed arrays without inspecting business metadata", () => {
    const column = createColumn({ type: "array" });

    expect(buildArraySummary(column, [])).toBe("—");
    expect(buildArraySummary(column, [{ name: "Ada" }, "mixed"])).toBe("共 2 项");
  });
});
