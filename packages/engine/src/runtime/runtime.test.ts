import { describe, expect, it } from "vitest";
import { Runtime } from ".";

describe("Runtime registration", () => {
  it("registers utilities and exposes them through $utils", () => {
    const runtime = new Runtime();
    const utility = () => "value";

    runtime.utils("schema.toColumns", utility);

    expect(runtime.createScope(undefined, {}).$utils).toEqual({
      schema: { toColumns: utility },
    });
  });

  it("reads components using domain fallback", () => {
    const runtime = new Runtime();
    const globalComponent = () => null;
    const domainComponent = () => null;
    runtime.component({ code: "Input", component: globalComponent });
    runtime.component({ code: "Input", component: domainComponent }, "customer");

    expect(runtime.component("Input")).toBe(globalComponent);
    expect(runtime.component("Input", "customer")).toBe(domainComponent);
    expect(runtime.component("Input", "unknown")).toBe(globalComponent);
  });
});
