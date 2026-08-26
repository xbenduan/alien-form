import { describe, expect, it } from "vitest";
import { BuilderRegistry } from "./registry";
import { BuilderRuntime } from "./runtime";

interface Document {
  fields: Array<{ id: string; children?: Document["fields"] }>;
}

describe("BuilderRuntime", () => {
  it("executes commands and supports undo and redo", () => {
    const builder = new BuilderRuntime<Document>({
      document: { fields: [] },
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
    const builder = new BuilderRuntime({ document: { value: 1 } });
    builder.replaceDocument({ value: 2 });
    expect(builder.document.get()).toEqual({ value: 2 });
    expect(builder.dirty.get()).toBe(true);
    builder.markClean();
    expect(builder.dirty.get()).toBe(false);
  });
});

describe("BuilderRegistry", () => {
  it("lets domain definitions override global definitions", () => {
    const registry = new BuilderRegistry();
    const createDefinition = (title: string) => ({
      code: "Input",
      component: title,
      authoring: { title, kind: "leaf" as const, create: () => ({}) },
      projection: {
        toForm: (field: unknown) => field,
        toFilter: (field: unknown) => field,
        toColumn: (field: unknown) => field,
      },
    });
    registry.registerGlobal([createDefinition("global")]);
    registry.registerDomain("users", [createDefinition("domain")]);

    expect(registry.resolve("Input")?.authoring.title).toBe("global");
    expect(registry.resolve("Input", "users")?.authoring.title).toBe("domain");
  });
});
