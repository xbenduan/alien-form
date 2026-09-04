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

  it("enumerates effective utilities and enums", () => {
    const runtime = new Runtime();
    const globalUtility = () => "global";
    const domainUtility = () => "domain";
    runtime.utils("format.value", globalUtility);
    runtime.utils("format.value", domainUtility, "customer");
    runtime.enum("status", ["active"]);
    runtime.enum("status", ["pending"], "customer");

    expect(runtime.utilityEntries("customer")).toEqual([["format.value", domainUtility]]);
    expect(runtime.utilityEntries("unknown")).toEqual([["format.value", globalUtility]]);
    expect(runtime.enumEntries("customer")).toEqual([["status", ["pending"]]]);
    expect(runtime.enumEntries("unknown")).toEqual([["status", ["active"]]]);
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
