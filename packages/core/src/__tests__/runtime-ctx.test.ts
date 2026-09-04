import { describe, expect, it } from "vitest";
import { createForm } from "../form";
import type { ExpressionScope, IFormSchema } from "../types";

describe("expression scope", () => {
  it("passes the fixed protocol namespaces to function rules", () => {
    let received: ExpressionScope | undefined;
    const schema: IFormSchema = {
      type: "object",
      properties: {
        name: {
          type: "string",
          "x-effect": (scope) => {
            received = scope;
          },
        },
      },
    };
    const form = createForm({
      schema,
      initialValues: { name: "Alien" },
      scope: {
        mode: "detail",
        $service: () => undefined,
        $utils: () => (value: unknown) => value,
        $enum: () => [],
        $query: { id: "7" },
        ignored: "not exposed",
      },
    });
    form.mount();

    expect(Object.keys(received!).sort()).toEqual([
      "$enum",
      "$form",
      "$path",
      "$query",
      "$row",
      "$self",
      "$service",
      "$utils",
      "$value",
      "$values",
      "mode",
    ]);
    expect(received?.$values).toEqual({ name: "Alien" });
    expect(received?.$path).toBe("name");
    expect(received?.mode).toBe("detail");
    expect((received as Record<string, unknown>).ignored).toBeUndefined();
  });

  it("provides row values without flattening them into the root scope", () => {
    const seen: unknown[] = [];
    const schema: IFormSchema = {
      type: "object",
      properties: {
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              capture: {
                type: "string",
                "x-effect": ({ $row }) => {
                  seen.push($row);
                },
              },
            },
          },
        },
      },
    };
    const form = createForm({ schema, initialValues: { rows: [{ name: "first" }] } });
    form.mount();
    expect(seen).toContainEqual({ name: "first" });
  });

  it("uses $form for imperative access", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        source: { type: "string" },
        target: {
          type: "string",
          "x-reaction": { value: ({ $form }) => $form.get("source") },
        },
      },
    };
    const form = createForm({ schema, initialValues: { source: "value" } });
    form.mount();
    expect(form.get("target")).toBe("value");
  });
});
