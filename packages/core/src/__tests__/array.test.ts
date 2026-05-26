import { describe, expect, it } from "vitest";
import { createForm } from "../index";
import type { IFormSchema } from "../schema/types";

const arraySchema: IFormSchema = {
  type: "object",
  properties: {
    users: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      },
    },
  },
};

describe("array field operations", () => {
  it("push creates new row fields", () => {
    const form = createForm();
    form.setSchema(arraySchema);

    const users = form.getArrayField("users");
    users?.push({ name: "Alice", age: 30 });

    expect(form.getField("users.0.name")?.value).toBe("Alice");
    expect(form.getField("users.0.age")?.value).toBe(30);
    expect(form.values).toEqual({ users: [{ name: "Alice", age: 30 }] });
  });

  it("remove deletes row and reindexes", () => {
    const form = createForm({ initialValues: { users: [{ name: "A" }, { name: "B" }, { name: "C" }] } });
    form.setSchema(arraySchema);

    form.getArrayField("users")?.remove(1);

    expect(form.getField("users.0.name")?.value).toBe("A");
    expect(form.getField("users.1.name")?.value).toBe("C");
    expect(form.getField("users.2.name")).toBeUndefined();
    expect(form.values).toEqual({ users: [{ name: "A" }, { name: "C" }] });
  });

  it("moveUp swaps rows preserving field identity", () => {
    const form = createForm({ initialValues: { users: [{ name: "A" }, { name: "B" }] } });
    form.setSchema(arraySchema);

    const fieldB = form.getField("users.1.name")!;
    form.getArrayField("users")?.moveUp(1);

    expect(form.getField("users.0.name")).toBe(fieldB);
    expect(form.values).toEqual({ users: [{ name: "B" }, { name: "A" }] });
  });

  it("moveDown swaps rows preserving field identity", () => {
    const form = createForm({ initialValues: { users: [{ name: "A" }, { name: "B" }] } });
    form.setSchema(arraySchema);

    const fieldA = form.getField("users.0.name")!;
    form.getArrayField("users")?.moveDown(0);

    expect(form.getField("users.1.name")).toBe(fieldA);
    expect(form.values).toEqual({ users: [{ name: "B" }, { name: "A" }] });
  });

  it("ignores invalid move operations", () => {
    const form = createForm({ initialValues: { users: [{ name: "A" }, { name: "B" }] } });
    form.setSchema(arraySchema);

    form.getArrayField("users")?.moveUp(0); // can't move first up
    form.getArrayField("users")?.moveDown(1); // can't move last down
    form.getArrayField("users")?.moveUp(-1); // invalid index
    form.getArrayField("users")?.moveDown(99); // invalid index

    expect(form.values).toEqual({ users: [{ name: "A" }, { name: "B" }] });
  });

  it("handles deeply nested arrays", () => {
    const form = createForm({
      initialValues: {
        specs: [{ name: "Color", values: [{ label: "Red" }, { label: "Blue" }] }],
      },
    });
    form.setSchema({
      type: "object",
      properties: {
        specs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              values: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    });

    expect(form.getField("specs.0.values.0.label")?.value).toBe("Red");
    expect(form.getField("specs.0.values.1.label")?.value).toBe("Blue");

    form.getArrayField("specs.0.values")?.remove(0);
    expect(form.getField("specs.0.values.0.label")?.value).toBe("Blue");
    expect(form.values).toEqual({ specs: [{ name: "Color", values: [{ label: "Blue" }] }] });
  });

  it("handles simple (non-object) array items", () => {
    const form = createForm({ initialValues: { tags: ["red", "blue"] } });
    form.setSchema({
      type: "object",
      properties: {
        tags: { type: "array", items: { type: "string" } },
      },
    });

    expect(form.getField("tags.0")?.value).toBe("red");
    expect(form.getField("tags.1")?.value).toBe("blue");

    form.getArrayField("tags")?.push("green");
    expect(form.values).toEqual({ tags: ["red", "blue", "green"] });
  });

  it("setValue replaces entire array content", () => {
    const form = createForm({ initialValues: { users: [{ name: "A" }] } });
    form.setSchema(arraySchema);

    form.setValues({ users: [{ name: "X" }, { name: "Y" }] });

    expect(form.getField("users.0.name")?.value).toBe("X");
    expect(form.getField("users.1.name")?.value).toBe("Y");
    expect(form.values).toEqual({ users: [{ name: "X" }, { name: "Y" }] });
  });

  it("reset restores initial array state", () => {
    const form = createForm({ initialValues: { users: [{ name: "Original" }] } });
    form.setSchema(arraySchema);

    form.getArrayField("users")?.push({ name: "Added" });
    expect(form.values.users).toHaveLength(2);

    form.reset();
    expect(form.values).toEqual({ users: [{ name: "Original" }] });
  });
});
