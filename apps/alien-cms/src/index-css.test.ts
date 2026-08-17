import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

describe("shared component style contract", () => {
  it("targets the current shared filter classes and responsive actions", () => {
    expect(css).toContain(".schema-filter-panel");
    expect(css).toContain(".schema-filter-form");
    expect(css).toContain("grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));");
    expect(css).toContain("grid-column: -2 / -1;");
    expect(css).toContain(".schema-filter-form > .filter-form-item:last-child > .ant-space");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(css).not.toMatch(/\.model-filter-(?:panel|form)\b/);
  });

  it("keeps the shared table toolbar responsive and table overflow local", () => {
    expect(css).toContain(".schema-table-toolbar");
    expect(css).toContain(".schema-table-toolbar-left");
    expect(css).toContain(".schema-table-toolbar-right");
    expect(css).toContain(".schema-table-body");
    expect(css).toContain("overflow-x: auto;");
    expect(css).toContain(".schema-table-toolbar-right > .ant-space");
    expect(css).not.toMatch(/\.protable-(?:body|toolbar)\b/);
  });
});
