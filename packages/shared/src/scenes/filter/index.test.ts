import type { IFormSchema } from "@alien-form/core";
import { describe, expect, it } from "vitest";
import { applyFilterVisibility } from "./index";

const schema: IFormSchema = {
  type: "object",
  properties: {
    name: { type: "string", display: "hidden" },
    status: { type: "string" },
  },
};

describe("applyFilterVisibility", () => {
  it("shows only projected default fields while collapsed", () => {
    const result = applyFilterVisibility(schema, false, ["name"]);

    expect(result.properties?.name?.display).toBe("visible");
    expect(result.properties?.status?.display).toBe("none");
  });

  it("shows every projected field while expanded", () => {
    const result = applyFilterVisibility(schema, true, []);

    expect(result.properties?.name?.display).toBe("visible");
    expect(result.properties?.status?.display).toBe("visible");
  });

  it("does not mutate the input schema", () => {
    applyFilterVisibility(schema, false, ["status"]);

    expect(schema.properties?.name?.display).toBe("hidden");
    expect(schema.properties?.status?.display).toBeUndefined();
  });
});
