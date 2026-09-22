import { describe, expect, it } from "vitest";
import { defineComponent, defineEnum, defineService, defineUtil } from "../registry";
import { Runtime } from ".";

describe("Runtime registration", () => {
  it("registers definitions and exposes executable values through scope", () => {
    const runtime = new Runtime();
    const list = () => "list";
    const utility = () => "value";
    runtime.service("record.list", defineService(list, { description: "列表" }));
    runtime.util("formatValue", defineUtil(utility, { description: "格式化" }));
    runtime.enum("status", defineEnum(["active"], { description: "状态" }));

    const scope = runtime.createScope(undefined, {});
    expect((scope.$service as (code: string) => unknown)("record.list")).toBe(list);
    expect((scope.$utils as { formatValue: unknown }).formatValue).toBe(utility);
    expect((scope.$enums as { status: unknown }).status).toEqual(["active"]);
    expect(() => (scope.$service as (code: string) => unknown)("record")).toThrow(
      '$service("record") 未注册',
    );
  });

  it("returns the effective declarative capabilities through one API", () => {
    const runtime = new Runtime();
    runtime.component(
      "Input",
      defineComponent(() => null, {
        injectContext: true,
        meta: { type: "string", kind: "leaf" },
      }),
    );
    runtime.service(
      "record.list",
      defineService(() => [], { description: "列表" }),
    );
    runtime.util(
      "formatValue",
      defineUtil(() => "", { description: "格式化" }),
    );
    runtime.enum("status", defineEnum(["active"], { description: "状态" }));

    expect(runtime.getCapabilities()).toEqual({
      components: [{ code: "Input", meta: { type: "string", kind: "leaf" } }],
      services: [{ code: "record.list", description: "列表" }],
      utilities: [{ code: "formatValue", description: "格式化" }],
      enums: [{ code: "status", description: "状态", value: ["active"] }],
    });
  });

  it("uses domain definitions with global fallback", () => {
    const runtime = new Runtime();
    const globalUtility = () => "global";
    const domainUtility = () => "domain";
    runtime.util("formatValue", defineUtil(globalUtility, { description: "global" }));
    runtime.util("formatValue", defineUtil(domainUtility, { description: "domain" }), "customer");
    runtime.enum("status", defineEnum(["active"], { description: "global" }));
    runtime.enum("status", defineEnum(["pending"], { description: "domain" }), "customer");

    const customer = runtime.createScope("customer", {});
    const unknown = runtime.createScope("unknown", {});
    expect((customer.$utils as { formatValue: unknown }).formatValue).toBe(domainUtility);
    expect((unknown.$utils as { formatValue: unknown }).formatValue).toBe(globalUtility);
    expect((customer.$enums as { status: unknown }).status).toEqual(["pending"]);
    expect((unknown.$enums as { status: unknown }).status).toEqual(["active"]);
    expect(runtime.getCapabilities("customer").utilities).toEqual([
      { code: "formatValue", description: "domain" },
    ]);
  });

  it("rejects duplicate registrations in the same domain", () => {
    const runtime = new Runtime();
    runtime.component(
      "Input",
      defineComponent(() => null),
      "customer",
    );
    runtime.service(
      "record.list",
      defineService(() => [], { description: "列表" }),
      "customer",
    );
    runtime.util(
      "formatValue",
      defineUtil(() => "", { description: "格式化" }),
      "customer",
    );
    runtime.enum("status", defineEnum(["active"], { description: "状态" }), "customer");

    expect(() =>
      runtime.component(
        "Input",
        defineComponent(() => null),
        "customer",
      ),
    ).toThrow('component "Input" 在 domain "customer" 下重复注册');
    expect(() =>
      runtime.service(
        "record.list",
        defineService(() => [], { description: "列表" }),
        "customer",
      ),
    ).toThrow('service "record.list" 在 domain "customer" 下重复注册');
    expect(() =>
      runtime.util(
        "formatValue",
        defineUtil(() => "", { description: "格式化" }),
        "customer",
      ),
    ).toThrow('util "formatValue" 在 domain "customer" 下重复注册');
    expect(() =>
      runtime.enum("status", defineEnum(["pending"], { description: "状态" }), "customer"),
    ).toThrow('enum "status" 在 domain "customer" 下重复注册');
  });

  it("requires utils and enums to use namespace-safe codes", () => {
    const runtime = new Runtime();
    expect(() =>
      runtime.util(
        "format.value",
        defineUtil(() => "", { description: "格式化" }),
      ),
    ).toThrow(/合法的 JavaScript 属性名/);
    expect(() => runtime.enum("field-types", defineEnum([], { description: "字段类型" }))).toThrow(
      /合法的 JavaScript 属性名/,
    );
  });

  it("allows the overrides layer to replace global registrations only", () => {
    const runtime = new Runtime();
    const originalComponent = () => null;
    const overriddenComponent = () => null;
    const overriddenService = () => "overridden";
    const overriddenUtility = () => "overridden";
    runtime.component("Input", defineComponent(originalComponent));
    runtime.service(
      "record.list",
      defineService(() => "original", { description: "列表" }),
    );
    runtime.util(
      "formatValue",
      defineUtil(() => "original", { description: "格式化" }),
    );
    runtime.enum("status", defineEnum(["active"], { description: "状态" }));

    runtime.withGlobalOverrides((overrides) => {
      overrides.component("Input", defineComponent(overriddenComponent));
      overrides.service(
        "record.list",
        defineService(overriddenService, { description: "覆盖列表" }),
      );
      overrides.util("formatValue", defineUtil(overriddenUtility, { description: "覆盖格式化" }));
      overrides.enum("status", defineEnum(["pending"], { description: "覆盖状态" }));
      expect(() =>
        overrides.enum("status", defineEnum(["duplicate"], { description: "重复" })),
      ).toThrow('enum "status" 在 overrides 下重复注册');
    });

    const scope = runtime.createScope(undefined, {});
    expect(runtime.resolveComponent("Input")?.component).toBe(overriddenComponent);
    expect((scope.$service as (code: string) => unknown)("record.list")).toBe(overriddenService);
    expect((scope.$utils as { formatValue: unknown }).formatValue).toBe(overriddenUtility);
    expect((scope.$enums as { status: unknown }).status).toEqual(["pending"]);
  });

  it("reads components using domain fallback", () => {
    const runtime = new Runtime();
    const globalComponent = () => null;
    const domainComponent = () => null;
    runtime.component("Input", defineComponent(globalComponent));
    runtime.component("Input", defineComponent(domainComponent), "customer");

    expect(runtime.resolveComponent("Input")?.component).toBe(globalComponent);
    expect(runtime.resolveComponent("Input", "customer")?.component).toBe(domainComponent);
    expect(runtime.resolveComponent("Input", "unknown")?.component).toBe(globalComponent);
  });
});
