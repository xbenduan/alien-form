import { describe, expect, it, vi } from "vitest";
import { createForm } from "../form";
import type { FormError, IFormSchema, PrimitiveFieldNode } from "../types";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const accessor =
  <T>(entries: Record<string, T>) =>
  (code: string) =>
    entries[code];

function primitive(form: ReturnType<typeof createForm>, path: string): PrimitiveFieldNode {
  const field = form.field(path);
  if (!field || field.kind !== "primitive") throw new Error(`primitive "${path}" missing`);
  return field;
}

describe("async rules", () => {
  it("applies an async reaction and reports rejection", async () => {
    const errors: FormError[] = [];
    const schema: IFormSchema = {
      type: "object",
      properties: {
        name: { type: "string", "x-reaction": { value: '{{ $service("loadName")() }}' } },
        failed: { type: "string", "x-reaction": { value: '{{ $service("fail")() }}' } },
      },
    };
    const form = createForm({
      schema,
      scope: {
        $service: accessor({
          loadName: async () => {
            await tick();
            return "async-name";
          },
          fail: async () => {
            await tick();
            throw new Error("async-fail");
          },
        }),
      },
      onError: (error) => errors.push(error),
    });
    form.mount();
    await tick();
    await tick();
    expect(form.get("name")).toBe("async-name");
    expect(errors.some((error) => error.message.includes("async-fail"))).toBe(true);
  });

  it("does not apply a stale async reaction after destroy", async () => {
    let resolveValue: (value: string) => void = () => {};
    const schema: IFormSchema = {
      type: "object",
      properties: {
        name: { type: "string", "x-reaction": { value: '{{ $service("slow")() }}' } },
      },
    };
    const form = createForm({
      schema,
      scope: {
        $service: accessor({
          slow: () =>
            new Promise<string>((resolve) => {
              resolveValue = resolve;
            }),
        }),
      },
    });
    form.mount();
    const field = primitive(form, "name");
    form.destroy();
    resolveValue("late");
    await tick();
    expect(field.value()).toBeUndefined();
  });

  it("awaits async validation", async () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        username: {
          type: "string",
          "x-validate": '{{ $service("checkUnique")($value) }}',
        },
      },
    };
    const form = createForm({
      schema,
      initialValues: { username: "taken" },
      scope: {
        $service: accessor({
          checkUnique: async (value: string) => {
            await tick();
            return value === "taken" ? "Username is taken" : true;
          },
        }),
      },
    });
    await expect(form.validate()).resolves.toBe(false);
    expect(form.errors().map((error) => error.message)).toContain("Username is taken");
  });

  it("owns synchronous and asynchronous effect disposers", async () => {
    const syncDispose = vi.fn();
    const asyncDispose = vi.fn();
    const schema: IFormSchema = {
      type: "object",
      properties: {
        sync: { type: "string", "x-effect": '{{ $utils("startSync")() }}' },
        async: { type: "string", "x-effect": '{{ $utils("startAsync")() }}' },
      },
    };
    const form = createForm({
      schema,
      scope: {
        $utils: accessor({
          startSync: () => syncDispose,
          startAsync: async () => {
            await tick();
            return asyncDispose;
          },
        }),
      },
    });
    form.mount();
    await tick();
    form.destroy();
    expect(syncDispose).toHaveBeenCalledOnce();
    expect(asyncDispose).toHaveBeenCalledOnce();
  });

  it("rejects async formatters and preserves raw values", async () => {
    const errors: FormError[] = [];
    const schema: IFormSchema = {
      type: "object",
      properties: {
        name: {
          type: "string",
          "x-format": {
            input: '{{ $utils("asyncFormat")($value) }}',
            output: '{{ $utils("asyncFormat")($value) }}',
          },
        },
      },
    };
    const form = createForm({
      schema,
      initialValues: { name: "raw" },
      scope: {
        $utils: accessor({ asyncFormat: async (value: string) => value.toUpperCase() }),
      },
      onError: (error) => errors.push(error),
    });
    expect(form.get("name")).toBe("raw");
    await expect(form.submit()).resolves.toEqual({ name: "raw" });
    expect(errors.some((error) => error.scope === "x-format" && error.key === "input")).toBe(true);
    expect(errors.some((error) => error.scope === "x-format" && error.key === "output")).toBe(true);
  });

  it("normalizes async data sources and loading state", async () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        city: {
          type: "string",
          dataSource: '{{ $service("cities")($values.province) }}',
        },
        province: { type: "string" },
      },
    };
    const form = createForm({
      schema,
      initialValues: { province: "zj" },
      scope: {
        $service: accessor({
          cities: async (province: string) => {
            await tick();
            return [{ label: province, value: "hz" }];
          },
        }),
      },
    });
    form.mount();
    expect(primitive(form, "city").loading()).toBe(true);
    await tick();
    await tick();
    expect(primitive(form, "city").loading()).toBe(false);
    expect(primitive(form, "city").dataSource()).toEqual([{ label: "zj", value: "hz" }]);
  });
});
