import type { ExpressionScope } from "@alien-form/core";
import { describe, expect, it } from "vitest";
import { Runtime } from "../runtime";

describe("definition registry", () => {
  it("uses domain definitions before global definitions", () => {
    const runtime = new Runtime();
    runtime.ui({
      code: "panel",
      title: "Global panel",
      component: "global",
      authoring: { children: true },
    });
    runtime.ui(
      {
        code: "panel",
        title: "User panel",
        description: "Domain-specific panel",
        component: "users",
        authoring: { children: false },
      },
      "users",
    );

    expect(runtime.registry.ui.resolve("panel")?.component).toBe("global");
    expect(runtime.registry.ui.resolve("panel", "users")?.component).toBe("users");
    expect(runtime.registry.ui.resolve("panel", "users")?.description).toBe(
      "Domain-specific panel",
    );
  });

  it("stores form components and handlers as complete definitions", () => {
    const runtime = new Runtime();
    const handler = (_scope: ExpressionScope) => "handled";

    runtime.formComponent({
      code: "Input",
      title: "Single-line input",
      description: "Edits short text.",
      component: "input-component",
      authoring: { fieldType: "string" },
    });
    runtime.formHandler({
      code: "required",
      title: "Required validator",
      description: "Rejects empty values.",
      handler,
      authoring: { kind: "x-validate" },
    });

    expect(runtime.registry.form.components.resolve("Input")).toMatchObject({
      title: "Single-line input",
      component: "input-component",
      authoring: { fieldType: "string" },
    });
    expect(runtime.registry.form.handlers.resolve("required")).toMatchObject({
      title: "Required validator",
      handler,
      authoring: { kind: "x-validate" },
    });
  });
});
