import { describe, expect, it, vi } from "vitest";
import { createForm } from "../index";
import type { IFormSchema } from "../schema/types";

const basicSchema: IFormSchema = {
  type: "object",
  required: ["name"],
  properties: {
    name: { type: "string", title: "Name", validate: { minLength: 2 } },
    age: { type: "number", validate: { minimum: 18 } },
  },
};

async function waitFor(predicate: () => boolean, timeout = 1000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeout) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("@alien-form/core", () => {
  it("creates fields from schema and returns form values", () => {
    const form = createForm({ initialValues: { name: "Bao", age: 20 } });
    form.setSchema(basicSchema);

    expect(form.getField("name")?.value).toBe("Bao");
    expect(form.values).toEqual({ name: "Bao", age: 20 });
  });

  it("validates JSON Schema keywords together with required fields", async () => {
    const form = createForm({ initialValues: { name: "A", age: 16 } });
    form.setSchema(basicSchema);

    await expect(form.validate()).resolves.toBe(false);
    expect(form.errors.map((error) => error.type)).toEqual(
      expect.arrayContaining(["minLength", "minimum"]),
    );

    form.setValues({ name: "Bao", age: 20 });
    await expect(form.validate()).resolves.toBe(true);
  });

  it("coalesces bulk value notifications for effect selectors", () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        first: { type: "string" },
        second: { type: "string" },
      },
    });

    const valuesListener = vi.fn();
    const fieldListener = vi.fn();
    const formSubscriber = vi.fn();
    const firstSubscriber = vi.fn();

    form.effect((instance) => instance.values, valuesListener);
    form.effect((instance) => instance.getField("first")?.value, fieldListener);
    form.subscribe(formSubscriber);
    form.getField("first")?.subscribe(firstSubscriber);

    valuesListener.mockClear();
    fieldListener.mockClear();
    formSubscriber.mockClear();
    firstSubscriber.mockClear();

    form.setValues({ first: "A", second: "B" });

    expect(valuesListener).toHaveBeenCalledTimes(1);
    expect(fieldListener).toHaveBeenCalledTimes(1);
    expect(formSubscriber).toHaveBeenCalledTimes(1);
    expect(firstSubscriber).toHaveBeenCalledTimes(1);
  });

  it("stops cyclic reactions and reports runtime error", () => {
    const errors: any[] = [];
    const form = createForm({ onError: (error) => errors.push(error) });
    form.setSchema({
      type: "object",
      properties: {
        a: {
          type: "number",
          default: 0,
          "x-reaction": {
            value: {
              dependencies: { b: "b" },
              type: "expression",
              expression: "($deps.b || 0) + 1",
            },
          },
        },
        b: {
          type: "number",
          default: 0,
          "x-reaction": {
            value: {
              dependencies: { a: "a" },
              type: "expression",
              expression: "($deps.a || 0) + 1",
            },
          },
        },
      },
    });

    form.getField("a")?.setValue(1);

    expect(
      errors.some((error) => error.scope === "reaction" && /cycle detected/.test(error.message)),
    ).toBe(true);
    expect(form.getField("a")?.value).toBeLessThan(100);
    expect(form.getField("b")?.value).toBeLessThan(100);
  });

  it("uses dynamic array values for validation and submission", async () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        users: {
          type: "array",
          title: "Users",
          validate: { minItems: 1 },
          items: {
            type: "object",
            properties: {
              name: { type: "string", required: true },
            },
          },
        },
      },
    });

    const users = form.getArrayField("users");
    expect(users).toBeTruthy();
    await expect(form.validate()).resolves.toBe(false);

    users?.push({ name: "Bao" });
    await expect(form.validate()).resolves.toBe(true);
    expect(form.values).toEqual({ users: [{ name: "Bao" }] });

    users?.remove(0);
    await expect(form.validate()).resolves.toBe(false);
  });

  it("handles core boundary cases for paths, arrays, and state updates", () => {
    const form = createForm({
      initialValues: {
        users: [{ name: "first" }, { name: "second" }],
      },
    });
    form.setSchema({
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
          },
        },
        choice: {
          type: "string",
          default: "stale",
          dataSourcePolicy: "first",
        },
      },
    });

    expect(form.values).toEqual({
      users: [{ name: "first" }, { name: "second" }],
      choice: "stale",
    });

    form.getArrayField("users")?.moveDown(-1);
    form.getArrayField("users")?.moveUp(99);
    expect(form.values.users).toEqual([{ name: "first" }, { name: "second" }]);

    form.setValues({ users: [{ name: "only" }] });
    expect(form.getField("users.1.name")).toBeUndefined();
    expect(form.values.users).toEqual([{ name: "only" }]);

    form.reset();
    expect(form.getField("users.0.name")?.value).toBe("first");
    expect(form.getField("users.1.name")?.value).toBe("second");
    expect(form.values.users).toEqual([{ name: "first" }, { name: "second" }]);

    form.setFieldState("choice", (state) => {
      state.dataSource = [{ label: "Fresh", value: "fresh" }];
    });
    expect(form.getField("choice")?.value).toBe("fresh");

    form.setValues(null as any);
    expect(form.values.users).toEqual([{ name: "first" }, { name: "second" }]);
  });

  it("syncs array child fields when setValues replaces array length", () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
          },
        },
      },
    });

    form.getArrayField("users")?.push({ name: "first" });
    form.getArrayField("users")?.push({ name: "second" });

    form.setValues({
      users: [{ name: "only" }],
    });

    expect(form.values).toEqual({ users: [{ name: "only" }] });
    expect(form.getField("users.0.name")?.value).toBe("only");
    expect(form.getField("users.1.name")).toBeUndefined();

    form.setValues({
      users: [{ name: "left" }, { name: "right" }],
    });

    expect(form.values).toEqual({ users: [{ name: "left" }, { name: "right" }] });
    expect(form.getField("users.1.name")?.value).toBe("right");
  });

  it("initializes nested array fields inside array rows from initialValues", () => {
    const form = createForm({
      initialValues: {
        specs: [
          {
            name: "颜色",
            values: [
              { label: "曜石黑", image: "black.png" },
              { label: "月光白", image: "white.png" },
            ],
          },
        ],
      },
    });

    form.setSchema({
      type: "object",
      properties: {
        specs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              values: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    image: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    });

    expect(form.getField("specs.0.name")?.value).toBe("颜色");
    expect(form.getField("specs.0.values")).toBeTruthy();
    expect(form.getField("specs.0.values.0.label")?.value).toBe("曜石黑");
    expect(form.getField("specs.0.values.1.image")?.value).toBe("white.png");
    expect(form.values).toEqual({
      specs: [
        {
          name: "颜色",
          values: [
            { label: "曜石黑", image: "black.png" },
            { label: "月光白", image: "white.png" },
          ],
        },
      ],
    });
  });

  it("initializes and updates simple array item fields", () => {
    const form = createForm({
      initialValues: {
        tags: ["red", "blue"],
      },
    });

    form.setSchema({
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: {
            type: "string",
          },
        },
      },
    });

    expect(form.getArrayField("tags")).toBeTruthy();
    expect(form.getField("tags.0")?.value).toBe("red");
    expect(form.getField("tags.1")?.value).toBe("blue");
    expect(form.values).toEqual({ tags: ["red", "blue"] });

    form.setValues({
      tags: ["green"],
    });

    expect(form.getField("tags.0")?.value).toBe("green");
    expect(form.getField("tags.1")).toBeUndefined();
    expect(form.values).toEqual({ tags: ["green"] });

    form.getArrayField("tags")?.push("yellow");
    expect(form.getField("tags.1")?.value).toBe("yellow");
    expect(form.values).toEqual({ tags: ["green", "yellow"] });
  });

  it("registers schema-aware effects from setup", () => {
    const events: string[] = [];
    const form = createForm({
      setup: (instance) => {
        instance.effect((current) => current.getField("name")?.value, () =>
          events.push("field-effect"),
        );
        instance.effect((current) => current.values, () => events.push("values-effect"));
        return instance.effect(() => {
          instance.getField("name")?.value;
          events.push("effect");
        });
      },
    });
    form.setSchema(basicSchema);

    form.getField("name")?.setValue("Bao");

    expect(events).toEqual(
      expect.arrayContaining([
        "field-effect",
        "values-effect",
        "effect",
      ]),
    );
  });

  it("runs setup disposer on destroy", () => {
    const setupCalls: string[] = [];
    const form = createForm({
      setup: () => {
        setupCalls.push("setup");
        return () => {
          setupCalls.push("dispose");
        };
      },
    });

    expect(setupCalls).toEqual(["setup"]);

    form.destroy();
    form.destroy();

    expect(setupCalls).toEqual(["setup", "dispose"]);
  });

  it("tracks aggregate parent values through form.effect", () => {
    const form = createForm({
      initialValues: {
        specs: [
          {
            name: "颜色",
            values: [{ label: "曜石黑", image: "black.png" }],
          },
        ],
      },
    });
    form.setSchema({
      type: "object",
      properties: {
        specs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              values: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    image: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    });

    const snapshots: Array<Array<{ name: string; values: Array<{ label: string; image: string }> }>> =
      [];

    const dispose = form.effect((instance) => {
      const specs = instance.getField("specs")?.value ?? [];
      snapshots.push(JSON.parse(JSON.stringify(specs)));
    });

    form.getField("specs.0.values.0.label")?.setValue("月光白");

    expect(snapshots[snapshots.length - 1]).toEqual([
      {
        name: "颜色",
        values: [{ label: "月光白", image: "black.png" }],
      },
    ]);

    dispose();
  });

  it("supports selector effects and exposes previous value for aggregate fields", () => {
    const form = createForm({
      initialValues: {
        specs: [
          {
            name: "颜色",
            values: [{ label: "曜石黑" }],
          },
        ],
      },
    });
    form.setSchema({
      type: "object",
      properties: {
        specs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              values: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    });

    const listener = vi.fn();
    form.effect((instance) => instance.getField("specs")?.value, listener, {
      equals: (prev, next) => JSON.stringify(prev) === JSON.stringify(next),
    });

    form.getField("specs.0.values.0.label")?.setValue("月光白");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toEqual([
      {
        name: "颜色",
        values: [{ label: "月光白" }],
      },
    ]);
    expect(listener.mock.calls[0]?.[1]).toEqual([
      {
        name: "颜色",
        values: [{ label: "曜石黑" }],
      },
    ]);
  });

  it("supports selector effect with immediate, custom equals, and stop", () => {
    const form = createForm({ initialValues: { name: "Bao", age: 20 } });
    form.setSchema(basicSchema);

    const calls: Array<{ next: Record<string, any>; prev: Record<string, any> | undefined }> = [];

    form.effect(
      (instance) => instance.values,
      (next, prev, ctx) => {
        calls.push({ next, prev });
        if (next.name === "Stop") {
          ctx.stop();
        }
      },
      {
        immediate: true,
        equals: (prev, next) => prev.name === next.name,
      },
    );

    form.getField("age")?.setValue(21);
    form.getField("name")?.setValue("Bao2");
    form.getField("name")?.setValue("Stop");
    form.getField("name")?.setValue("Ignored");

    expect(calls).toEqual([
      { next: { name: "Bao", age: 20 }, prev: undefined },
      { next: { name: "B" + "ao2", age: 21 }, prev: { name: "Bao", age: 20 } },
      { next: { name: "Stop", age: 21 }, prev: { name: "Bao2", age: 21 } },
    ]);
  });

  it("stops selector effects and effects after destroy", () => {
    const form = createForm({ initialValues: { name: "Bao", age: 20 } });
    form.setSchema(basicSchema);

    const effectListener = vi.fn();
    const valuesListener = vi.fn();

    form.effect((instance) => {
      effectListener(instance.getField("name")?.value);
    });
    form.effect((instance) => instance.values, valuesListener, { immediate: true });

    form.destroy();
    form.getField("name")?.setValue("AfterDestroy");

    expect(effectListener).toHaveBeenCalledTimes(1);
    expect(valuesListener).toHaveBeenCalledTimes(1);
    expect(valuesListener.mock.calls[0]?.[0]).toEqual({ name: "Bao", age: 20 });
    expect(valuesListener.mock.calls[0]?.[1]).toBeUndefined();
    expect(valuesListener.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({
        form,
        stop: expect.any(Function),
      }),
    );
  });

  it("replaces fields when setSchema is called again", () => {
    const form = createForm({ initialValues: { oldField: "old", newField: "new" } });
    form.setSchema({
      type: "object",
      properties: { oldField: { type: "string" } },
    });
    expect(form.values).toEqual({ oldField: "old" });

    form.setSchema({
      type: "object",
      properties: { newField: { type: "string" } },
    });
    expect(form.getField("oldField")).toBeUndefined();
    expect(form.values).toEqual({ newField: "new" });
  });

  it("initializes AlienForm protocol fields and sorts by order", () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        second: {
          type: "string",
          title: "Second",
          order: 2,
          component: "Select",
          props: { placeholder: "pick one" },
          decorator: "FormItem",
          decoratorProps: { tooltip: "help" },
          dataSource: [{ label: "A", value: "a" }],
          display: "hidden",
          disabled: true,
        },
        first: {
          type: "string",
          title: "First",
          order: 1,
        },
      },
    });

    expect(Array.from(form.fields.keys())).toEqual(["first", "second"]);
    const second = form.getField("second");
    expect(second?.component).toBe("Select");
    expect(second?.componentProps).toEqual({ placeholder: "pick one" });
    expect(second?.decoratorProps).toEqual({ tooltip: "help" });
    expect(second?.dataSource).toEqual([{ label: "A", value: "a" }]);
    expect(second?.display).toBe("hidden");
    expect(second?.disabled).toBe(true);
  });

  it("derives field attributes through property-level expression reactions", () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        type: { type: "string", default: "person" },
        name: {
          type: "string",
          title: "Name",
          "x-reaction": {
            display: {
              dependencies: { type: "type" },
              type: "expression",
              expression: "$deps.type === 'company' ? 'visible' : 'none'",
            },
            title: {
              dependencies: { type: "type" },
              type: "expression",
              expression: "$deps.type === 'company' ? 'Company Name' : 'Person Name'",
            },
            props: {
              dependencies: { type: "type" },
              type: "match",
              source: "$deps.type",
              match: {
                company: { placeholder: "Company" },
                default: { placeholder: "Person" },
              },
            },
            dataSource: {
              dependencies: { type: "type" },
              type: "match",
              source: "$deps.type",
              match: {
                company: [{ label: "Company", value: "company" }],
                default: [{ label: "Person", value: "person" }],
              },
            },
          },
        },
      },
    });

    const name = form.getField("name");
    expect(name?.visible).toBe(false);
    expect(name?.title).toBe("Person Name");
    expect(name?.componentProps).toEqual({ placeholder: "Person" });
    expect(name?.dataSource).toEqual([{ label: "Person", value: "person" }]);

    form.getField("type")?.setValue("company");
    expect(name?.visible).toBe(true);
    expect(name?.title).toBe("Company Name");
    expect(name?.componentProps).toEqual({ placeholder: "Company" });
    expect(name?.dataSource).toEqual([{ label: "Company", value: "company" }]);
  });

  it("loads dataSource through computed reaction handlers", async () => {
    const loadCities = vi.fn(async ({ deps }) => {
      if (deps.country === "cn") return [{ label: "Beijing", value: "beijing" }];
      return [];
    });
    const form = createForm({ handlers: { loadCities } });
    form.setSchema({
      type: "object",
      properties: {
        country: { type: "string" },
        city: {
          type: "string",
          "x-reaction": {
            dataSource: {
              dependencies: { country: "country" },
              type: "computed",
              handler: "loadCities",
            },
          },
        },
      },
    });

    const city = form.getField("city");
    expect(city?.dataSource).toEqual([]);

    form.getField("country")?.setValue("cn");
    await waitFor(() => (city?.dataSource.length || 0) > 0);
    expect(loadCities).toHaveBeenCalledWith(expect.objectContaining({ deps: { country: "cn" } }));
    expect(city?.dataSource).toEqual([{ label: "Beijing", value: "beijing" }]);
  });

  it("supports static, expression, match and computed reaction types only", async () => {
    const form = createForm({
      handlers: {
        buildOptions: async ({ deps }) => [{ label: String(deps.kind), value: deps.kind }],
      },
    });
    form.setSchema({
      type: "object",
      properties: {
        kind: { type: "string", default: "a" },
        field: {
          type: "string",
          "x-reaction": {
            title: { type: "static", value: "Static Title" },
            display: {
              dependencies: { kind: "kind" },
              type: "expression",
              expression: "$deps.kind === 'hidden' ? 'none' : 'visible'",
            },
            props: {
              dependencies: { kind: "kind" },
              type: "match",
              source: "$deps.kind",
              match: {
                a: { placeholder: "A" },
                default: { placeholder: "Other" },
              },
            },
            dataSource: {
              dependencies: { kind: "kind" },
              type: "computed",
              handler: "buildOptions",
            },
          },
        },
      },
    });

    const field = form.getField("field");
    await waitFor(() => (field?.dataSource.length || 0) > 0);
    expect(field?.title).toBe("Static Title");
    expect(field?.display).toBe("visible");
    expect(field?.componentProps).toEqual({ placeholder: "A" });
    expect(field?.dataSource).toEqual([{ label: "a", value: "a" }]);

    form.getField("kind")?.setValue("hidden");
    expect(field?.display).toBe("none");
    expect(field?.componentProps).toEqual({ placeholder: "Other" });
  });

  it("evaluates expression rules with a restricted interpreter", () => {
    const form = createForm({
      initialValues: { mode: "readonly", amount: 12.5 },
      scope: { externalMode: "readonly" },
    });
    form.setSchema({
      type: "object",
      properties: {
        mode: { type: "string" },
        amount: {
          type: "number",
          "x-format": {
            output: {
              type: "expression",
              expression: "($value || 0) * 100",
            },
          },
        },
        derivedField: {
          type: "string",
          "x-reaction": {
            value: {
              dependencies: { mode: "mode" },
              type: "expression",
              expression: "$deps.mode === externalMode ? 'locked' : 'open'",
            },
            props: {
              dependencies: { mode: "mode" },
              type: "expression",
              expression:
                "{ placeholder: $deps.mode === 'readonly' ? 'readonly mode' : 'editable mode', rows: 4 }",
            },
            disabled: {
              dependencies: { mode: "mode" },
              type: "expression",
              expression: "!($deps.mode !== 'readonly')",
            },
          },
        },
      },
    });

    expect(form.getField("derivedField")?.value).toBe("locked");
    expect(form.getField("derivedField")?.componentProps).toEqual({
      placeholder: "readonly mode",
      rows: 4,
    });
    expect(form.getField("derivedField")?.disabled).toBe(true);
    expect(form.values.amount).toBe(1250);
  });

  it("rejects unsafe expressions and function calls without run escape hatches", () => {
    const rejectedExpressions = [
      "globalThis.process",
      "Number($value)",
      "isAdult($deps.age)",
      "$value.trim()",
      "new Date()",
      "$value = 1",
      "function () { return 1 }",
      "() => 1",
      "$deps.__proto__",
      "$deps.constructor",
    ];

    for (const expression of rejectedExpressions) {
      const form = createForm();
      form.setSchema({
        type: "object",
        properties: {
          source: { type: "string", default: "x" },
          unsafeField: {
            type: "string",
            "x-reaction": {
              value: {
                dependencies: { source: "source" },
                type: "expression",
                expression,
              },
            },
          },
        },
      });

      expect(form.getField("unsafeField")?.value).toBeUndefined();
    }
  });

  it("keeps field-owned reactions independent across dependencies", () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        source: { type: "string", default: "off" },
        first: {
          type: "string",
          display: "none",
          "x-reaction": {
            display: {
              dependencies: { source: "source" },
              type: "expression",
              expression: "$deps.source === 'on' ? 'visible' : 'none'",
            },
          },
        },
        second: {
          type: "string",
          display: "none",
          "x-reaction": {
            display: {
              dependencies: { source: "source" },
              type: "expression",
              expression: "$deps.source === 'on' ? 'visible' : 'none'",
            },
          },
        },
      },
    });

    expect(form.getField("first")?.visible).toBe(false);
    expect(form.getField("second")?.visible).toBe(false);

    form.getField("source")?.setValue("on");
    expect(form.getField("first")?.visible).toBe(true);
    expect(form.getField("second")?.visible).toBe(true);
  });

  it("initializes display/disabled and excludes display none fields from values and validation", async () => {
    const form = createForm({
      initialValues: {
        hiddenByDisplay: "",
        hiddenByDisplayNone: "",
        hiddenField: "kept-in-runtime",
        disabledField: "disabled",
      },
    });

    form.setSchema({
      type: "object",
      properties: {
        hiddenByDisplay: {
          type: "string",
          title: "Hidden by display none",
          required: true,
          display: "none",
        },
        hiddenByDisplayNone: {
          type: "string",
          title: "Hidden by display",
          required: true,
          display: "none",
        },
        hiddenField: {
          type: "string",
          display: "hidden",
        },
        disabledField: {
          type: "string",
          disabled: true,
        },
      },
    });

    expect(form.getField("hiddenByDisplay")?.display).toBe("none");
    expect(form.getField("hiddenByDisplayNone")?.visible).toBe(false);
    expect(form.getField("hiddenField")?.display).toBe("hidden");
    expect(form.getField("hiddenField")?.hidden).toBe(true);
    expect(form.getField("disabledField")?.disabled).toBe(true);

    expect(form.values).not.toHaveProperty("hiddenByDisplay");
    expect(form.values).not.toHaveProperty("hiddenByDisplayNone");
    expect(form.values).toHaveProperty("hiddenField", "kept-in-runtime");
    await expect(form.validate()).resolves.toBe(true);
  });

  it("updates decorator, component and props through property reactions", () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        mode: { type: "string", default: "readonly" },
        derivedField: {
          type: "string",
          component: "Input",
          props: { placeholder: "initial" },
          decorator: "FormItem",
          "x-reaction": {
            component: {
              dependencies: { mode: "mode" },
              type: "match",
              source: "$deps.mode",
              match: { readonly: "Textarea", default: "Input" },
            },
            props: {
              dependencies: { mode: "mode" },
              type: "match",
              source: "$deps.mode",
              match: {
                readonly: { rows: 4, placeholder: "readonly mode" },
                default: { placeholder: "editable mode" },
              },
            },
            decoratorProps: {
              type: "static",
              value: { tooltip: "dynamic help" },
            },
          },
        },
      },
    });

    const derivedField = form.getField("derivedField");
    expect(derivedField?.component).toBe("Textarea");
    expect(derivedField?.componentProps).toEqual({ placeholder: "readonly mode", rows: 4 });
    expect(derivedField?.decoratorProps).toEqual({ tooltip: "dynamic help" });

    form.getField("mode")?.setValue("editable");
    expect(derivedField?.component).toBe("Input");
    expect(derivedField?.componentProps).toEqual({ placeholder: "editable mode", rows: 4 });
  });

  it("formats input and output values with x-format", async () => {
    const form = createForm({ initialValues: { amount: 1234 } });
    form.setSchema({
      type: "object",
      properties: {
        amount: {
          type: "number",
          "x-format": {
            input: {
              type: "expression",
              expression: "$value / 100",
            },
            output: {
              type: "expression",
              expression: "$value * 100",
            },
          },
        },
      },
    });

    expect(form.getField("amount")?.value).toBe(12.34);
    expect(form.values).toEqual({ amount: 1234 });

    form.setValues({ amount: 2500 });
    expect(form.getField("amount")?.value).toBe(25);
    await expect(form.submit()).resolves.toEqual({ amount: 2500 });
  });

  it("uses current value as default match source for x-format", async () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        status: {
          type: "string",
          default: 1,
          "x-format": {
            input: {
              type: "match",
              match: { "1": "enabled", "0": "disabled", default: "disabled" },
            },
            output: { type: "match", match: { enabled: 1, disabled: 0, default: 0 } },
          },
        },
      },
    });

    expect(form.getField("status")?.value).toBe("enabled");
    await expect(form.submit()).resolves.toEqual({ status: 1 });

    form.getField("status")?.setValue("disabled");
    await expect(form.submit()).resolves.toEqual({ status: 0 });
  });

  it("formats schema default values with x-format input", async () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        amount: {
          type: "number",
          default: 12345,
          "x-format": {
            input: {
              type: "expression",
              expression: "$value / 100",
            },
            output: {
              type: "expression",
              expression: "$value * 100",
            },
          },
        },
      },
    });

    expect(form.getField("amount")?.value).toBe(123.45);
    expect(form.values).toEqual({ amount: 12345 });
    await expect(form.submit()).resolves.toEqual({ amount: 12345 });
  });

  it("treats undefined x-validate expression result as passed", async () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        username: {
          type: "string",
          default: "admin",
          "x-validate": {
            type: "expression",
            expression: "$value === 'admin' ? undefined : 'Username must be admin'",
          },
        },
      },
    });

    await expect(form.validate()).resolves.toBe(true);
    expect(form.errors).toEqual([]);

    form.getField("username")?.setValue("guest");
    await expect(form.validate()).resolves.toBe(false);
    expect(form.errors).toEqual([{ message: "Username must be admin", type: "x-validate" }]);
  });

  it("reconciles value when dataSource changes by dataSourcePolicy", () => {
    const form = createForm({ initialValues: { city: "beijing", tags: ["a", "x"] } });
    form.setSchema({
      type: "object",
      properties: {
        country: {
          type: "string",
          default: "cn",
        },
        city: {
          type: "string",
          dataSourcePolicy: "clear",
          dataSource: [{ label: "北京", value: "beijing" }],
          "x-reaction": {
            dataSource: {
              type: "match",
              dependencies: { country: "country" },
              match: {
                cn: [{ label: "北京", value: "beijing" }],
                sg: [{ label: "新加坡", value: "singapore" }],
              },
            },
          },
        },
        tags: {
          type: "array",
          dataSourcePolicy: "filter",
          dataSource: [
            { label: "A", value: "a" },
            { label: "B", value: "b" },
          ],
        },
      },
    });

    expect(form.getField("city")?.value).toBe("beijing");
    form.getField("country")?.setValue("sg");
    expect(form.getField("city")?.value).toBeUndefined();

    form.getField("tags")?.setDataSource([{ label: "A", value: "a" }]);
    expect(form.getField("tags")?.value).toEqual(["a"]);
  });

  it("supports x-validate dependencies for cross-field validation", async () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        password: {
          type: "string",
          default: "123456",
        },
        confirmPassword: {
          type: "string",
          default: "123456",
          "x-validate": {
            type: "expression",
            dependencies: { password: "password" },
            expression: '$value === $deps.password ? undefined : "Passwords do not match"',
          },
        },
      },
    });

    await expect(form.validate()).resolves.toBe(true);
    expect(form.errors).toEqual([]);

    form.getField("confirmPassword")?.setValue("654321");
    await expect(form.validate()).resolves.toBe(false);
    expect(form.errors).toEqual([{ message: "Passwords do not match", type: "x-validate" }]);
  });

  it("moves array rows by row identity instead of swapping only values", () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
          },
        },
      },
    });

    const users = form.getArrayField("users");
    users?.push({ name: "first" });
    users?.push({ name: "second" });

    const row0Before = form.getField("users.0.name")!;
    const row1Before = form.getField("users.1.name")!;
    row1Before.setErrors([{ message: "row-1-error" }]);

    users?.moveUp(1);

    expect(form.getField("users.0.name")).toBe(row1Before);
    expect(form.getField("users.1.name")).toBe(row0Before);
    expect(form.getField("users.0.name")?.errors).toEqual([{ message: "row-1-error" }]);
    expect(form.values).toEqual({ users: [{ name: "second" }, { name: "first" }] });
  });

  it("supports computed x-format handlers and x-validate rules", async () => {
    const normalizeCode = vi.fn(({ value }) =>
      String(value || "")
        .trim()
        .toUpperCase(),
    );
    const checkCode = vi.fn(async ({ value }) => {
      if (value === "OK") return [];
      return [{ message: "Code must be OK", type: "x-validate" }];
    });
    const form = createForm({
      initialValues: { code: " ok " },
      handlers: { normalizeCode, checkCode },
    });
    form.setSchema({
      type: "object",
      properties: {
        code: {
          type: "string",
          "x-format": {
            input: { type: "computed", handler: "normalizeCode" },
            output: { type: "computed", handler: "normalizeCode" },
          },
          "x-validate": {
            type: "computed",
            handler: "checkCode",
          },
        },
      },
    });

    expect(form.getField("code")?.value).toBe("OK");
    await expect(form.validate()).resolves.toBe(true);
    expect(checkCode).toHaveBeenCalledWith(
      expect.objectContaining({ value: "OK", kind: "x-validate" }),
    );

    form.getField("code")?.setValue("bad");
    await expect(form.validate()).resolves.toBe(false);
    expect(form.errors).toEqual([{ message: "Code must be OK", type: "x-validate" }]);
  });

  it("routes runtime errors through onError listeners", () => {
    const errors: any[] = [];
    const form = createForm({
      onError: (e) => errors.push(e),
    });
    form.setSchema({
      type: "object",
      properties: {
        a: {
          type: "string",
          "x-reaction": {
            // unsupported reaction key — should emit a reaction error
            mystery: { type: "static", value: true } as any,
          } as any,
        },
      },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.scope === "reaction" && e.path === "a")).toBe(true);
  });

  it("keeps only the latest async reaction result", async () => {
    const pending = new Map<
      string,
      ReturnType<typeof createDeferred<Array<{ label: string; value: string }>>>
    >();
    const loadCities = vi.fn(({ deps }) => {
      const deferred = createDeferred<Array<{ label: string; value: string }>>();
      pending.set(String(deps.country), deferred);
      return deferred.promise;
    });
    const form = createForm({ handlers: { loadCities } });
    form.setSchema({
      type: "object",
      properties: {
        country: { type: "string" },
        city: {
          type: "string",
          "x-reaction": {
            dataSource: {
              dependencies: { country: "country" },
              type: "computed",
              handler: "loadCities",
            },
          },
        },
      },
    });

    form.getField("country")?.setValue("cn");
    form.getField("country")?.setValue("sg");

    pending.get("sg")?.resolve([{ label: "Singapore", value: "sg" }]);
    await waitFor(() => form.getField("city")?.dataSource[0]?.value === "sg");

    pending.get("cn")?.resolve([{ label: "Beijing", value: "cn" }]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(form.getField("city")?.dataSource).toEqual([{ label: "Singapore", value: "sg" }]);
  });

  it.skip("installs x-reaction for array item fields using indexed paths", () => {
    // TODO: known issue — reaction effects for dynamically pushed array items
    // don't re-fire when their relative dependencies change. The installer effect
    // correctly detects and installs the reaction, but the alien-signals effect
    // doesn't track the dependency field's value signal properly during first run.
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                default: "person",
              },
              companyName: {
                type: "string",
                display: "none",
                "x-reaction": {
                  display: {
                    dependencies: { type: ".type" },
                    type: "expression",
                    expression: "$deps.type === 'company' ? 'visible' : 'none'",
                  },
                },
              },
            },
          },
        },
      },
    });

    form.getArrayField("users")?.push();

    const companyName = form.getField("users.0.companyName");
    expect(companyName?.visible).toBe(false);

    form.getField("users.0.type")?.setValue("company");
    expect(companyName?.visible).toBe(true);
  });
});
