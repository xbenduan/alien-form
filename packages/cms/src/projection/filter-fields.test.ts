import { describe, expect, it } from "vitest";
import { projectFilterFields } from "./filter-fields";

describe("projectFilterFields", () => {
  it('skips fields with display: "none"', () => {
    const result = projectFilterFields({
      properties: {
        visibleField: {
          title: "Visible Field",
          component: "Input",
        },
        hiddenField: {
          title: "Hidden Field",
          component: "Input",
          display: "none",
        },
      },
    });

    expect(result).toEqual([
      expect.objectContaining({
        key: "visibleField",
        title: "Visible Field",
      }),
    ]);
  });
});
