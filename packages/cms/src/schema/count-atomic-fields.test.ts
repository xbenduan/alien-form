import { describe, expect, it } from "vitest";
import { countAtomicFields } from "./count-atomic-fields";

describe("countAtomicFields", () => {
  it("counts top-level primitive fields", () => {
    expect(
      countAtomicFields({
        properties: {
          a: { type: "string" },
          b: { type: "number" },
        },
      } as never),
    ).toBe(2);
  });

  it("recurses into nested object/void fields", () => {
    expect(
      countAtomicFields({
        properties: {
          name: { type: "string" },
          address: {
            type: "object",
            properties: {
              city: { type: "string" },
              zip: { type: "string" },
            },
          },
        },
      } as never),
    ).toBe(3);
  });

  it("recurses into array-of-object item leaf fields", () => {
    expect(
      countAtomicFields({
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sku: { type: "string" },
                qty: { type: "number" },
              },
            },
          },
        },
      } as never),
    ).toBe(2);
  });

  it("counts an array of primitives as a single leaf", () => {
    expect(
      countAtomicFields({
        properties: {
          tags: { type: "array", items: { type: "string" } },
        },
      } as never),
    ).toBe(1);
  });

  it("returns 0 for schema without properties", () => {
    expect(countAtomicFields(undefined)).toBe(0);
  });
});
