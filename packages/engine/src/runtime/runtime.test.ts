import { describe, expect, it } from "vitest";
import { Runtime } from ".";

describe("Runtime registration", () => {
  it("registers utilities and exposes them through $utils", () => {
    const runtime = new Runtime();
    const utility = () => "value";

    runtime.utils("schema.toColumns", utility);

    const scope = runtime.createScope(undefined, {});
    expect((scope.$utils as (code: string) => unknown)("schema.toColumns")).toBe(utility);
  });

  it("resolves complete codes without treating dots as property paths", () => {
    const runtime = new Runtime();
    const list = () => "list";
    runtime.service("record.list", list);
    runtime.enum("field-types.v2", ["text"]);

    const scope = runtime.createScope(undefined, {});
    expect((scope.$service as (code: string) => unknown)("record.list")).toBe(list);
    expect((scope.$enum as (code: string) => unknown)("field-types.v2")).toEqual(["text"]);
    expect(() => (scope.$service as (code: string) => unknown)("record")).toThrow(
      '$service("record") 未注册',
    );
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

  it("rejects duplicate registrations in the same domain", () => {
    const runtime = new Runtime();
    runtime.component({ code: "Input", component: () => null }, "customer");
    runtime.service("record.list", () => [], "customer");
    runtime.utils("format.value", () => "", "customer");
    runtime.enum("status", ["active"], "customer");

    expect(() => runtime.component({ code: "Input", component: () => null }, "customer")).toThrow(
      'component "Input" 在 domain "customer" 下重复注册',
    );
    expect(() => runtime.service("record.list", () => [], "customer")).toThrow(
      'service "record.list" 在 domain "customer" 下重复注册',
    );
    expect(() => runtime.utils("format.value", () => "", "customer")).toThrow(
      'utils "format.value" 在 domain "customer" 下重复注册',
    );
    expect(() => runtime.enum("status", ["pending"], "customer")).toThrow(
      'enum "status" 在 domain "customer" 下重复注册',
    );
  });

  it("rejects duplicate global registrations", () => {
    const runtime = new Runtime();
    runtime.enum("status", ["active"]);

    expect(() => runtime.enum("status", ["pending"])).toThrow('enum "status" 在 global 下重复注册');
  });

  it("allows the overrides layer to replace global registrations only", () => {
    const runtime = new Runtime();
    const originalComponent = () => null;
    const overriddenComponent = () => null;
    const overriddenService = () => "overridden";
    const overriddenUtility = () => "overridden";
    runtime.component({ code: "Input", component: originalComponent });
    runtime.service("record.list", () => "original");
    runtime.utils("format.value", () => "original");
    runtime.enum("status", ["active"]);

    runtime.withGlobalOverrides((overrides) => {
      overrides.component({ code: "Input", component: overriddenComponent });
      overrides.service("record.list", overriddenService);
      overrides.utils("format.value", overriddenUtility);
      overrides.enum("status", ["pending"]);
      expect(() => overrides.enum("status", ["duplicate"])).toThrow(
        'enum "status" 在 overrides 下重复注册',
      );
    });

    runtime.enum("status", ["customer"], "customer");
    expect(() => runtime.enum("status", ["duplicate"], "customer")).toThrow(
      'enum "status" 在 domain "customer" 下重复注册',
    );

    const scope = runtime.createScope(undefined, {});
    const domainScope = runtime.createScope("customer", {});
    expect(runtime.resolveComponent("Input")?.component).toBe(overriddenComponent);
    expect((scope.$service as (code: string) => unknown)("record.list")).toBe(overriddenService);
    expect((scope.$utils as (code: string) => unknown)("format.value")).toBe(overriddenUtility);
    expect((scope.$enum as (code: string) => unknown)("status")).toEqual(["pending"]);
    expect((domainScope.$enum as (code: string) => unknown)("status")).toEqual(["customer"]);
    expect(runtime.enumEntries("customer")).toEqual([["status", ["customer"]]]);
    expect(() => runtime.enum("status", ["strict-again"])).toThrow(
      'enum "status" 在 global 下重复注册',
    );
  });

  it("reads components using domain fallback", () => {
    const runtime = new Runtime();
    const globalComponent = () => null;
    const domainComponent = () => null;
    runtime.component({ code: "Input", component: globalComponent });
    runtime.component({ code: "Input", component: domainComponent }, "customer");

    expect(runtime.resolveComponent("Input")?.component).toBe(globalComponent);
    expect(runtime.resolveComponent("Input", "customer")?.component).toBe(domainComponent);
    expect(runtime.resolveComponent("Input", "unknown")?.component).toBe(globalComponent);
  });
});
