import { describe, expect, it } from "vitest";
import { createRegistry } from "@alien-form/engine";
import { BuilderRuntime } from "./runtime";

interface Document {
  fields: Array<{ id: string; children?: Document["fields"] }>;
}

describe("BuilderRuntime", () => {
  it("executes commands and supports undo and redo", () => {
    const registry = createRegistry();
    const builder = new BuilderRuntime<Document>({
      document: { fields: [] },
      registry,
      domain: "users",
      commands: {
        "field.add": (document, field: Document["fields"][number]) => ({
          ...document,
          fields: [...document.fields, field],
        }),
        "field.remove": (document, id: string) => ({
          ...document,
          fields: document.fields.filter((field) => field.id !== id),
        }),
      },
    });

    builder.dispatch("field.add", { id: "name" });
    expect(builder.dirty.get()).toBe(true);
    builder.dispatch("field.remove", "name");
    expect(builder.document.get().fields).toEqual([]);
    expect(builder.dirty.get()).toBe(false);

    builder.undo();
    expect(builder.document.get().fields).toEqual([{ id: "name" }]);
    builder.redo();
    expect(builder.document.get().fields).toEqual([]);
  });

  it("replaces documents only through a command and resets dirty state after save", () => {
    const builder = new BuilderRuntime({
      document: { value: 1 },
      registry: createRegistry(),
      domain: "users",
    });
    builder.replaceDocument({ value: 2 });
    expect(builder.document.get()).toEqual({ value: 2 });
    expect(builder.dirty.get()).toBe(true);
    builder.markClean();
    expect(builder.dirty.get()).toBe(false);
  });
  it("exposes the shared Engine registry and model domain", () => {
    const registry = createRegistry();
    const builder = new BuilderRuntime({
      document: { value: 1 },
      registry,
      domain: "users",
    });

    expect(builder.registry).toBe(registry);
    expect(builder.domain).toBe("users");
  });

  it("derives the active domain from the current document", () => {
    const builder = new BuilderRuntime({
      document: { modelId: "users" },
      registry: createRegistry(),
      domain: (document) => document.modelId,
    });

    expect(builder.domain).toBe("users");
    builder.replaceDocument({ modelId: "orders" });
    expect(builder.domain).toBe("orders");
  });
});
