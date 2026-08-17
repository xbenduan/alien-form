import { describe, expect, it } from "vitest";
import type { CmsModelSchema } from "../types";
import { countAtomicFields } from "./count-atomic-fields";

describe("countAtomicFields", () => {
  it("统计顶层原子字段", () => {
    const schema = {
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: "number" },
      },
    } satisfies CmsModelSchema;

    expect(countAtomicFields(schema)).toBe(2);
  });

  it("递归统计 object 和 x-layout 的叶子字段", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        address: {
          type: "object",
          properties: {
            city: { type: "string" },
          },
        },
        section: {
          "x-layout": "SectionCard",
          properties: {
            note: { type: "string" },
          },
        },
      },
    } satisfies CmsModelSchema;

    expect(countAtomicFields(schema)).toBe(3);
  });

  it("递归统计对象数组，并将基本类型数组视为一个叶子", () => {
    const schema = {
      type: "object",
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
        tags: {
          type: "array",
          items: { type: "string" },
        },
      },
    } satisfies CmsModelSchema;

    expect(countAtomicFields(schema)).toBe(3);
  });

  it("对无 properties 的输入返回 0", () => {
    expect(countAtomicFields(undefined)).toBe(0);
  });
});
