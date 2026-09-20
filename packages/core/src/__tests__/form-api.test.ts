import { describe, expect, it, vi } from "vitest";
import { createForm } from "../form";
import type { IFormSchema } from "../types";

const flat = (): IFormSchema => ({
  type: "object",
  properties: { a: { type: "number" }, b: { type: "string" } },
});

describe("form.effect — runner overload", () => {
  it("runs the runner reactively and disposes via the returned handle", () => {
    const seen: number[] = [];
    const form = createForm({ schema: flat(), initialValues: { a: 1 } });
    const dispose = form.effect((f) => {
      seen.push(f.getFieldValue("a"));
    });
    expect(seen).toContain(1);
    form.setFieldValue("a", 2);
    expect(seen).toContain(2);
    dispose();
    form.setFieldValue("a", 3);
    expect(seen).not.toContain(3);
  });

  it("tracks only fields read through getFieldValue", () => {
    const seen: number[] = [];
    const form = createForm({ schema: flat(), initialValues: { a: 1, b: "x" } });
    form.effect((current) => {
      seen.push(current.getFieldValue("a"));
    });

    form.setFieldValue("b", "y");
    expect(seen).toEqual([1]);
    form.setFieldValue("a", 2);
    expect(seen).toEqual([1, 2]);
  });

  it("tracks fields created or replaced at a dynamic array path", () => {
    const seen: unknown[] = [];
    const form = createForm({
      schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "object", properties: { name: { type: "string" } } },
          },
        },
      },
    });
    form.effect((current) => {
      seen.push(current.getFieldValue(["items", 0, "name"]));
    });

    const items = form.field("items");
    if (items?.kind !== "array") throw new Error("items must be an array field");
    items.push({ name: "first" });
    items.setRows([{ name: "second" }]);
    form.setFieldValue(["items", 0, "name"], "third");

    expect(seen).toEqual([undefined, "first", "second", "third"]);
  });

  it("does not invalidate static field reads when an unrelated array moves", () => {
    const form = createForm({
      schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          items: {
            type: "array",
            items: { type: "object", properties: { name: { type: "string" } } },
          },
        },
      },
      initialValues: { title: "stable", items: [{ name: "a" }, { name: "b" }] },
    });
    const seen: string[] = [];
    form.effect((current) => seen.push(current.getFieldValue("title")));

    const items = form.field("items");
    if (items?.kind !== "array") throw new Error("items must be an array field");
    items.move(0, 1);

    expect(seen).toEqual(["stable"]);
  });

  it("registers a runner-returned cleanup that the framework owns", () => {
    const cleanup = vi.fn();
    const form = createForm({ schema: flat(), initialValues: { a: 1 } });
    form.effect(() => cleanup);
    form.destroy();
    expect(cleanup).toHaveBeenCalled();
  });

  it("continues destroying form effects when one cleanup throws", () => {
    const errors: string[] = [];
    const cleanup = vi.fn();
    const form = createForm({
      schema: flat(),
      onError: (error) => errors.push(error.message),
    });
    form.effect(() => () => {
      throw new Error("form cleanup failed");
    });
    form.effect(() => cleanup);

    expect(() => form.destroy()).not.toThrow();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(errors).toContain("form cleanup failed");
  });
});

describe("form.effect — selector + listener overload", () => {
  it("fires the listener only when the selected value changes", () => {
    const listener = vi.fn();
    const form = createForm({ schema: flat(), initialValues: { a: 1 } });
    form.effect((f) => f.getFieldValue("a"), listener);
    // not called on initialization (no immediate)
    expect(listener).not.toHaveBeenCalled();
    form.setFieldValue("a", 2);
    expect(listener).toHaveBeenCalledWith(2, 1);
  });

  it("respects the immediate option by firing once at init", () => {
    const listener = vi.fn();
    const form = createForm({ schema: flat(), initialValues: { a: 5 } });
    form.effect((f) => f.getFieldValue("a"), listener, { immediate: true });
    expect(listener).toHaveBeenCalledWith(5, undefined);
  });

  it("skips the listener when the equals comparator reports no change", () => {
    const listener = vi.fn();
    const form = createForm({ schema: flat(), initialValues: { a: 1 } });
    // custom equals: treat all numbers as equal -> listener never fires on change
    form.effect((f) => f.getFieldValue("a"), listener, { equals: () => true });
    form.setFieldValue("a", 999);
    expect(listener).not.toHaveBeenCalled();
  });

  it("disposes the selector effect and stops firing", () => {
    const listener = vi.fn();
    const form = createForm({ schema: flat(), initialValues: { a: 1 } });
    const dispose = form.effect((f) => f.getFieldValue("a"), listener);
    dispose();
    form.setFieldValue("a", 2);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("form runtime lifecycle", () => {
  it("installs the root runtime once per mount", () => {
    const start = vi.fn();
    const cleanup = vi.fn();
    const form = createForm({
      schema: {
        type: "object",
        "x-effect": () => {
          start();
          return cleanup;
        },
      },
    });

    form.mount();
    form.mount();
    expect(start).toHaveBeenCalledOnce();
    form.unmount();
    expect(cleanup).toHaveBeenCalledOnce();
    form.mount();
    expect(start).toHaveBeenCalledTimes(2);
    form.destroy();
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("keeps separate instances when schema objects are reused across fields", () => {
    const start = vi.fn();
    const shared = { type: "string", "x-effect": start } as const;
    const form = createForm({
      schema: {
        type: "object",
        properties: { first: shared, second: shared },
      },
    });

    form.mount();

    expect(start).toHaveBeenCalledTimes(2);
    expect(form.field("first")).not.toBe(form.field("second"));
  });
});

describe("form.setFieldsValue", () => {
  it("bulk-sets primitive values by path", () => {
    const form = createForm({ schema: flat(), initialValues: { a: 1, b: "x" } });
    form.setFieldsValue({ a: 10, b: "y" });
    expect(form.getFieldValue("a")).toBe(10);
    expect(form.getFieldValue("b")).toBe("y");
  });

  it("ignores undefined entries and leaves existing values intact", () => {
    const form = createForm({ schema: flat(), initialValues: { a: 1, b: "keep" } });
    form.setFieldsValue({ a: 2 });
    expect(form.getFieldValue("a")).toBe(2);
    expect(form.getFieldValue("b")).toBe("keep");
  });

  it("is a no-op for a non-object argument", () => {
    const form = createForm({ schema: flat(), initialValues: { a: 1 } });
    expect(() => form.setFieldsValue(null as any)).not.toThrow();
    expect(form.getFieldValue("a")).toBe(1);
  });

  it("sets array rows through setFieldsValue", async () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        list: { type: "array", items: { type: "object", properties: { v: { type: "string" } } } },
      },
    };
    const form = createForm({ schema, initialValues: { list: [{ v: "a" }] } });
    form.setFieldsValue({ list: [{ v: "x" }, { v: "y" }] });
    expect(form.getFieldValue("list[].v")).toEqual(["x", "y"]);
    expect(form.getFieldValue(["list", 1, "v"])).toBe("y");
  });

  it("updates nested object leaves without replacing their field topology", () => {
    const form = createForm({
      schema: {
        type: "object",
        properties: {
          profile: {
            type: "object",
            properties: {
              name: { type: "string" },
              city: { type: "string" },
            },
          },
        },
      },
      initialValues: { profile: { name: "A", city: "Shanghai" } },
    });
    const profile = form.field("profile");
    const name = form.field("profile.name");

    form.setFieldsValue({ profile: { name: "B" } });

    expect(form.field("profile")).toBe(profile);
    expect(form.field("profile.name")).toBe(name);
    expect(form.data).toEqual({ profile: { name: "B", city: "Shanghai" } });
  });

  it("releases the global batch when a bulk write throws", () => {
    const observed: string[] = [];
    const form = createForm({ schema: flat(), initialValues: { a: 1 } });
    const other = createForm({ schema: flat(), initialValues: { b: "before" } });
    other.effect((current) => {
      observed.push(current.getFieldValue("b"));
    });

    expect(() => form.setFieldsValue({ a: { invalid: true } })).toThrow(TypeError);
    other.setFieldValue("b", "after");
    expect(observed).toEqual(["before", "after"]);
  });
});

describe("form.resetFields", () => {
  it("restores primitive fields to their schema defaults", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: { a: { type: "number", default: 100 }, b: { type: "string", default: "def" } },
    };
    const form = createForm({ schema, initialValues: { a: 1, b: "x" } });
    form.setFieldValue("a", 2);
    form.resetFields();
    expect(form.getFieldValue("a")).toBe(100);
    expect(form.getFieldValue("b")).toBe("def");
  });

  it("recursively resets fields nested inside an object field", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        group: {
          type: "object",
          properties: { inner: { type: "string", default: "def" } },
        },
      },
    };
    const form = createForm({ schema, initialValues: { group: { inner: "changed" } } });
    form.setFieldValue("group.inner", "edited");
    form.resetFields();
    expect(form.getFieldValue("group.inner")).toBe("def");
  });
});

describe("form value access", () => {
  it("reads fields through string and array paths", () => {
    const form = createForm({ schema: flat(), initialValues: { a: 1, b: "x" } });
    expect(form.getFieldValue("a")).toBe(1);
    expect(form.getFieldValue(["b"])).toBe("x");
  });

  it("returns undefined for an unknown path", () => {
    const form = createForm({ schema: flat() });
    expect(form.getFieldValue("nope")).toBeUndefined();
  });

  it("exposes an immutable non-reactive raw data snapshot", () => {
    const runs: number[] = [];
    const form = createForm({ schema: flat(), initialValues: { a: 1, b: "x" } });
    const first = form.data;
    form.effect((current) => {
      runs.push(current.data.a);
    });

    expect(first).toEqual({ a: 1, b: "x" });
    expect(Object.isFrozen(first)).toBe(true);
    expect(() => {
      (first as Record<string, unknown>).a = 2;
    }).toThrow();

    form.setFieldValue("a", 2);
    expect(first.a).toBe(1);
    expect(form.data).toEqual({ a: 2, b: "x" });
    expect(form.data).not.toBe(first);
    expect(runs).toEqual([1]);
  });

  it("keeps raw data separate from output projection", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        amount: {
          type: "string",
          "x-format": { output: ({ $value }) => Number($value) },
        },
        internal: { type: "string", display: "none" },
      },
    };
    const form = createForm({
      schema,
      initialValues: { amount: "12.5", internal: "keep" },
    });

    expect(form.data).toEqual({ amount: "12.5", internal: "keep" });
    expect(form.getOutput()).toEqual({ amount: 12.5 });
  });

  it("keeps an explicit empty object in data and output", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        group: { type: "object", properties: { inner: { type: "string" } } },
      },
    };
    const form = createForm({ schema });
    expect(form.data).toEqual({ group: {} });
    expect(form.getOutput()).toEqual({ group: {} });
  });
});

describe("form.setInitialValues + reset interaction", () => {
  it("does not retroactively change current values, only the baseline", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: { a: { type: "number" } },
    };
    const form = createForm({ schema, initialValues: { a: 1 } });
    form.setInitialValues({ a: 50 });
    // current value unchanged until a rebuild/reset that reads initial values
    expect(form.getFieldValue("a")).toBe(1);
  });
});

describe("config.definitions $ref merge", () => {
  it("does not apply config.definitions by field path without an explicit $ref", async () => {
    const form = createForm({
      schema: flat(),
      definitions: {
        a: { "x-validate": () => ({ message: "from config definition" }) },
      },
    });

    await expect(form.validate()).resolves.toBe(true);
    expect(form.field("a")?.errors()).toEqual([]);
    expect(form.field("b")?.errors()).toEqual([]);
  });

  it("resolves config.definitions only through an explicit $ref", async () => {
    const form = createForm({
      schema: {
        type: "object",
        properties: {
          a: { $ref: "#/definitions/InjectedNumber" },
        },
      },
      definitions: {
        InjectedNumber: {
          type: "number",
          component: "NumberInput",
          "x-validate": () => ({ message: "from config definition" }),
        },
      },
    });

    await expect(form.validate()).resolves.toBe(false);
    expect(form.field("a")?.component()).toBe("NumberInput");
    expect(form.field("a")?.errors()).toEqual([
      { message: "from config definition", type: "x-validate" },
    ]);
  });

  it("lets config definitions override schema definitions with the same name", async () => {
    const form = createForm({
      schema: {
        type: "object",
        definitions: {
          Shared: {
            type: "string",
            title: "from schema",
            component: "Input",
            "x-validate": () => ({ message: "from schema definition" }),
          },
        },
        properties: {
          a: { $ref: "#/definitions/Shared" },
        },
      },
      definitions: {
        Shared: {
          type: "number",
          title: "from config",
          component: "NumberInput",
          "x-validate": () => ({ message: "from config definition" }),
        },
      },
    });

    await expect(form.validate()).resolves.toBe(false);
    expect(form.schema.definitions?.Shared.title).toBe("from config");
    expect(form.field("a")?.title()).toBe("from config");
    expect(form.field("a")?.component()).toBe("NumberInput");
    expect(form.field("a")?.errors()).toEqual([
      { message: "from config definition", type: "x-validate" },
    ]);
  });

  it("resolves nested fields from a config definition referenced by $ref", async () => {
    const form = createForm({
      schema: {
        type: "object",
        properties: {
          profile: { $ref: "#/definitions/Profile" },
        },
      },
      definitions: {
        Profile: {
          type: "object",
          properties: {
            name: { type: "string", "x-validate": () => ({ message: "ref child resolved" }) },
          },
        },
      },
    });

    await expect(form.validate()).resolves.toBe(false);
    expect(form.field("profile.name")?.errors()).toEqual([
      { message: "ref child resolved", type: "x-validate" },
    ]);
  });
});

describe("form.onError listener registration", () => {
  it("invokes added listeners and stops after unsubscribe", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        a: { type: "string", "x-reaction": { value: "{{ $utils.missing() }}" } },
      },
    };
    const seen: string[] = [];
    const form = createForm({ schema });
    const off = form.onError((e) => seen.push(e.message));
    form.mount();
    expect(seen.length).toBeGreaterThan(0);
    off();
    const before = seen.length;
    form.unmount();
    form.mount();
    // listener removed -> no further growth from this listener
    expect(seen.length).toBe(before);
  });
});

describe("form.getFieldsValue", () => {
  it("returns all values when called with no names", () => {
    const form = createForm({ schema: flat(), initialValues: { a: 1, b: "x" } });
    expect(form.getFieldsValue()).toEqual({ a: 1, b: "x" });
  });

  it("returns an empty array result as all values", () => {
    const form = createForm({ schema: flat(), initialValues: { a: 1, b: "x" } });
    expect(form.getFieldsValue([])).toEqual({ a: 1, b: "x" });
  });

  it("projects only the requested primitive fields", () => {
    const form = createForm({ schema: flat(), initialValues: { a: 1, b: "x" } });
    expect(form.getFieldsValue(["a"])).toEqual({ a: 1 });
  });

  it("projects a nested object subtree by path", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        group: {
          type: "object",
          properties: {
            inner: { type: "string" },
            other: { type: "number" },
          },
        },
      },
    };
    const form = createForm({
      schema,
      initialValues: { group: { inner: "v", other: 42 } },
    });
    expect(form.getFieldsValue(["group"])).toEqual({ group: { inner: "v", other: 42 } });
  });

  it("builds a nested structure for dotted leaf paths", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        group: {
          type: "object",
          properties: { inner: { type: "string" } },
        },
      },
    };
    const form = createForm({ schema, initialValues: { group: { inner: "v" } } });
    expect(form.getFieldsValue(["group.inner"])).toEqual({ group: { inner: "v" } });
  });

  it("silently skips unknown paths", () => {
    const form = createForm({ schema: flat(), initialValues: { a: 1 } });
    expect(form.getFieldsValue(["a", "nope"])).toEqual({ a: 1 });
  });
});

describe("form.validate(names)", () => {
  it("validates only the named field and leaves sibling errors untouched", async () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        a: { type: "string", required: true },
        b: { type: "string", required: true },
      },
    };
    const form = createForm({ schema });
    const ok = await form.validate(["a"]);
    expect(ok).toBe(false);
    expect(form.field("a")?.errors().length).toBeGreaterThan(0);
    expect(form.field("b")?.errors()).toEqual([]);
  });

  it("validates a container together with all its descendants", async () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        group: {
          type: "object",
          properties: {
            inner: { type: "string", required: true },
          },
        },
      },
    };
    const form = createForm({ schema });
    const ok = await form.validate(["group"]);
    expect(ok).toBe(false);
    expect(form.field("group.inner")?.errors().length).toBeGreaterThan(0);
  });

  it("validates all visible fields when called without names", async () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        a: { type: "string", required: true },
        b: { type: "string", required: true },
      },
    };
    const form = createForm({ schema });
    const ok = await form.validate();
    expect(ok).toBe(false);
    expect(form.field("a")?.errors().length).toBeGreaterThan(0);
    expect(form.field("b")?.errors().length).toBeGreaterThan(0);
  });
});

describe("form.getFieldsValueFast / validateFast", () => {
  it("returns an empty object when no fields are registered", () => {
    const form = createForm({ schema: flat(), initialValues: { a: 1, b: "x" } });
    expect(form.getFieldsValueFast()).toEqual({});
  });

  it("projects only registered (mounted) fields", () => {
    const form = createForm({ schema: flat(), initialValues: { a: 1, b: "x" } });
    form._registerField(form.field("a")!);
    expect(form.getFieldsValueFast()).toEqual({ a: 1 });
  });

  it("projects a whole mounted container subtree", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        group: {
          type: "object",
          component: "ObjectField",
          properties: {
            inner: { type: "string" },
          },
        },
      },
    };
    const form = createForm({ schema, initialValues: { group: { inner: "v" } } });
    form._registerField(form.field("group")!);
    expect(form.getFieldsValueFast()).toEqual({ group: { inner: "v" } });
  });

  it("skips display:none subtrees even when registered", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        a: { type: "string", display: "none" },
        b: { type: "string" },
      },
    };
    const form = createForm({ schema, initialValues: { a: 1, b: "x" } });
    form._registerField(form.field("a")!);
    form._registerField(form.field("b")!);
    expect(form.getFieldsValueFast()).toEqual({ b: "x" });
  });

  it("stops projecting a field after it is unregistered", () => {
    const form = createForm({ schema: flat(), initialValues: { a: 1, b: "x" } });
    const fieldA = form.field("a")!;
    form._registerField(fieldA);
    expect(form.getFieldsValueFast()).toEqual({ a: 1 });
    form._unregisterField(fieldA);
    expect(form.getFieldsValueFast()).toEqual({});
  });

  it("validateFast only validates registered fields", async () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        a: { type: "string", required: true },
        b: { type: "string", required: true },
      },
    };
    const form = createForm({ schema });
    form._registerField(form.field("a")!);
    const ok = await form.validateFast();
    expect(ok).toBe(false);
    expect(form.field("a")?.errors().length).toBeGreaterThan(0);
    expect(form.field("b")?.errors()).toEqual([]);
  });

  it("validateFast ignores display:none registered fields", async () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        a: { type: "string", required: true, display: "none" },
      },
    };
    const form = createForm({ schema });
    form._registerField(form.field("a")!);
    await expect(form.validateFast()).resolves.toBe(true);
    expect(form.field("a")?.errors()).toEqual([]);
  });

  it("clears registered fields when the form is destroyed", () => {
    const form = createForm({ schema: flat(), initialValues: { a: 1 } });
    form._registerField(form.field("a")!);
    form.destroy();
    expect(form.getFieldsValueFast()).toEqual({});
  });
});
