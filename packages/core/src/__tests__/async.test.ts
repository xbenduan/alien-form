import { describe, expect, it, vi } from "vitest";
import { createForm } from "../form";
import type { FormError, IFormSchema, PrimitiveFieldNode } from "../types";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const serviceAccessor =
  <T>(entries: Record<string, T>) =>
  (code: string) =>
    entries[code];
const namespace = <T>(entries: Record<string, T>) => entries;

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
        $service: serviceAccessor({
          loadName: async (): Promise<string> => {
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
    expect(form.getFieldValue("name")).toBe("async-name");
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
        $service: serviceAccessor({
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

  it("keeps the latest async reaction result when promises resolve out of order", async () => {
    const pending = new Map<string, (value: string) => void>();
    const form = createForm({
      schema: {
        type: "object",
        properties: {
          source: { type: "string" },
          target: {
            type: "string",
            "x-reaction": {
              title: ({ $form }) =>
                new Promise<string>((resolve) => {
                  pending.set($form.getFieldValue("source"), resolve);
                }),
            },
          },
        },
      },
      initialValues: { source: "old" },
    });
    form.mount();
    form.setFieldValue("source", "new");

    pending.get("new")?.("new result");
    await tick();
    expect(form.field("target")?.title()).toBe("new result");

    pending.get("old")?.("old result");
    await tick();
    expect(form.field("target")?.title()).toBe("new result");
  });

  it("invalidates async reactions when an array move changes their path", async () => {
    const pending: Array<{ path: string; resolve(value: string): void }> = [];
    const form = createForm({
      schema: {
        type: "object",
        properties: {
          rows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                result: {
                  type: "string",
                  "x-reaction": {
                    title: ({ $path }) =>
                      new Promise<string>((resolve) => pending.push({ path: $path, resolve })),
                  },
                },
              },
            },
          },
        },
      },
      initialValues: { rows: [{ result: "a" }, { result: "b" }] },
    });
    form.mount();
    const stale = pending.splice(0);
    const rows = form.field("rows");
    if (rows?.kind !== "array") throw new Error("rows must be an array field");

    rows.move(0, 1);
    const current = pending.splice(0);
    for (const item of current) item.resolve(`new:${item.path}`);
    await tick();
    for (const item of stale) item.resolve(`old:${item.path}`);
    await tick();

    expect(form.field("rows.0.result")?.title()).toBe("new:rows.0.result");
    expect(form.field("rows.1.result")?.title()).toBe("new:rows.1.result");
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
        $service: serviceAccessor({
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

  it("keeps only the latest async validation result", async () => {
    const pending = new Map<string, (result: true | string) => void>();
    const form = createForm({
      schema: {
        type: "object",
        properties: {
          username: {
            type: "string",
            "x-validate": ({ $value }) =>
              new Promise<true | string>((resolve) => pending.set($value, resolve)),
          },
        },
      },
      initialValues: { username: "old" },
    });
    const field = primitive(form, "username");

    const stale = field.validate();
    field.setValue("new");
    const current = field.validate();
    pending.get("new")?.(true);
    await current;
    pending.get("old")?.("stale error");
    await stale;

    expect(field.errors()).toEqual([]);
    expect(field.validateStatus()).toBe("success");
  });

  it("discards validation results after the validated value changes", async () => {
    let resolveValidation: (result: string) => void = () => {};
    const form = createForm({
      schema: {
        type: "object",
        properties: {
          username: {
            type: "string",
            "x-validate": () =>
              new Promise<string>((resolve) => {
                resolveValidation = resolve;
              }),
          },
        },
      },
      initialValues: { username: "old" },
    });
    const field = primitive(form, "username");

    const validation = field.validate();
    field.setValue("new");
    resolveValidation("stale error");
    await validation;

    expect(field.errors()).toEqual([]);
    expect(field.validateStatus()).toBe("");
  });

  it("owns synchronous and asynchronous effect disposers", async () => {
    const syncDispose = vi.fn();
    const asyncDispose = vi.fn();
    const schema: IFormSchema = {
      type: "object",
      properties: {
        sync: { type: "string", "x-effect": "{{ $utils.startSync() }}" },
        async: { type: "string", "x-effect": "{{ $utils.startAsync() }}" },
      },
    };
    const form = createForm({
      schema,
      scope: {
        $utils: namespace({
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

  it("runs an async effect cleanup that resolves after destroy", async () => {
    const cleanup = vi.fn();
    let resolveEffect: (dispose: () => void) => void = () => {};
    const form = createForm({
      schema: {
        type: "object",
        properties: {
          value: {
            type: "string",
            "x-effect": () =>
              new Promise<() => void>((resolve) => {
                resolveEffect = resolve;
              }),
          },
        },
      },
    });

    form.mount();
    form.destroy();
    resolveEffect(cleanup);
    await tick();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("continues unmounting when one effect cleanup throws", () => {
    const errors: FormError[] = [];
    const firstStart = vi.fn();
    const secondStart = vi.fn();
    const secondCleanup = vi.fn();
    const form = createForm({
      schema: {
        type: "object",
        properties: {
          first: {
            type: "string",
            "x-effect": () => {
              firstStart();
              return () => {
                throw new Error("cleanup failed");
              };
            },
          },
          second: {
            type: "string",
            "x-effect": () => {
              secondStart();
              return secondCleanup;
            },
          },
        },
      },
      onError: (error) => errors.push(error),
    });

    form.mount();
    expect(() => form.unmount()).not.toThrow();
    expect(secondCleanup).toHaveBeenCalledOnce();
    expect(errors.some((error) => error.message === "cleanup failed")).toBe(true);

    form.mount();
    expect(firstStart).toHaveBeenCalledTimes(2);
    expect(secondStart).toHaveBeenCalledTimes(2);
  });

  it("rejects async formatters and preserves raw values", async () => {
    const errors: FormError[] = [];
    const schema: IFormSchema = {
      type: "object",
      properties: {
        name: {
          type: "string",
          "x-format": {
            input: "{{ $utils.asyncFormat($value) }}",
            output: "{{ $utils.asyncFormat($value) }}",
          },
        },
      },
    };
    const form = createForm({
      schema,
      initialValues: { name: "raw" },
      scope: {
        $utils: namespace({ asyncFormat: async (value: string) => value.toUpperCase() }),
      },
      onError: (error) => errors.push(error),
    });
    expect(form.getFieldValue("name")).toBe("raw");
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
          dataSource: '{{ $service("cities")($form.getFieldValue("province")) }}',
        },
        province: { type: "string" },
      },
    };
    const form = createForm({
      schema,
      initialValues: { province: "zj" },
      scope: {
        $service: serviceAccessor({
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
