import { describe, expect, it } from "vitest";
import type { AlienSchema } from "@alien-form/protocol";
import { publicRecord } from "@alien-form/alienbase";

describe("record visibility", () => {
  it("removes every field marked private without model-specific rules", () => {
    const schema = {
      fields: [
        { key: "name", private: false },
        { key: "secret", private: true },
      ],
    } as AlienSchema;
    const record = { id: "1", name: "公开", secret: "内部" };

    expect(publicRecord(schema, record)).toEqual({ id: "1", name: "公开" });
    expect(record).toHaveProperty("secret", "内部");
  });
});
