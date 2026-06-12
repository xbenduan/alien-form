import { describe, expect, it } from "vitest";
import { projectTableColumns } from "./table-columns";

describe("projectTableColumns", () => {
  it("keeps all top-level fields and orders by x-cms.table.order / field.order", () => {
    const columns = projectTableColumns({
      properties: {
        a: { title: "A", order: 2 },
        b: { title: "B", order: 1 },
        c: { title: "C", "x-cms": { table: { order: 0 } } },
      },
    });

    expect(columns.map((column) => column.key)).toEqual(["c", "b", "a"]);
  });

  it("defaults system fields to not visible but keeps non-system fields visible", () => {
    const columns = projectTableColumns({
      properties: {
        name: { title: "名称" },
        id: { title: "ID" },
        createdAt: { title: "创建时间" },
      },
    });

    const byKey = Object.fromEntries(columns.map((column) => [column.key, column]));
    expect(byKey.name.defaultVisible).toBe(true);
    expect(byKey.id.defaultVisible).toBe(false);
    expect(byKey.createdAt.defaultVisible).toBe(false);
  });

  it("honors an explicit x-cms.table.visible flag for defaultVisible", () => {
    const columns = projectTableColumns({
      properties: {
        id: { title: "ID", "x-cms": { table: { visible: true } } },
        name: { title: "名称", "x-cms": { table: { visible: false } } },
      },
    });

    const byKey = Object.fromEntries(columns.map((column) => [column.key, column]));
    expect(byKey.id.defaultVisible).toBe(true);
    expect(byKey.name.defaultVisible).toBe(false);
  });

  it("derives column meta from x-cms.table", () => {
    const [column] = projectTableColumns({
      properties: {
        tags: {
          title: "标签",
          "x-cms": {
            table: { width: 120, ellipsis: false, expandable: true, inline: ["a"] },
          },
        },
      },
    });

    expect(column).toEqual(
      expect.objectContaining({
        width: 120,
        ellipsis: false,
        expandable: true,
        inline: ["a"],
      }),
    );
  });
});
