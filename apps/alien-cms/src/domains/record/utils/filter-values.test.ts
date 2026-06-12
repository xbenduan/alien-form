import { describe, expect, it } from "vitest";
import { flattenFilterValues, restoreFilterValues } from "./filter-values";

describe("restoreFilterValues", () => {
  it("restores $root.<path> keys into a nested object", () => {
    expect(
      restoreFilterValues({
        name: "alice",
        "$root.address.city": "上海",
      }),
    ).toEqual({
      name: "alice",
      address: { city: "上海" },
    });
  });

  it("drops empty / nullish values", () => {
    expect(
      restoreFilterValues({
        name: "",
        keep: "x",
        nothing: undefined,
        empty: null,
      }),
    ).toEqual({ keep: "x" });
  });
});

describe("flattenFilterValues", () => {
  it("flattens nested objects into $root.<path> keys", () => {
    expect(
      flattenFilterValues({
        name: "alice",
        address: { city: "上海" },
      }),
    ).toEqual({
      name: "alice",
      "$root.address.city": "上海",
    });
  });

  it("is the inverse of restoreFilterValues", () => {
    const nested = { name: "alice", address: { city: "上海", zip: "200000" } };
    expect(restoreFilterValues(flattenFilterValues(nested))).toEqual(nested);
  });
});
