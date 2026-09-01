import { describe, expect, it, vi } from "vitest";
import { createForm } from "../form";
import type { FormError, IFormSchema, PrimitiveFieldNode } from "../types";

function primitive(form: ReturnType<typeof createForm>, path: string): PrimitiveFieldNode {
  const field = form.field(path);
  if (!field || field.kind !== "primitive") throw new Error(`primitive "${path}" missing`);
  return field;
}

describe("reactions", () => {
  it("reacts to values through the closed $values namespace", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        a: { type: "number" },
        b: { type: "number", "x-reaction": { value: "{{ $values.a * 2 }}" } },
      },
    };
    const form = createForm({ schema, initialValues: { a: 3 } });
    form.mount();
    expect(form.get("b")).toBe(6);
    form.set("a", 10);
    expect(form.get("b")).toBe(20);
  });

  it("calls injected utilities", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        a: { type: "number" },
        b: { type: "number", "x-reaction": { value: "{{ $utils.double($values.a) }}" } },
      },
    };
    const form = createForm({
      schema,
      initialValues: { a: 4 },
      scope: { $utils: { double: (value: number) => value * 2 } },
    });
    form.mount();
    expect(form.get("b")).toBe(8);
  });

  it("applies display, disabled and required targets", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        name: {
          type: "string",
          "x-reaction": {
            display: "{{ $values.enabled ? 'visible' : 'none' }}",
            disabled: "{{ !$values.enabled }}",
            required: "{{ $values.enabled }}",
          },
        },
      },
    };
    const form = createForm({ schema, initialValues: { enabled: false } });
    form.mount();
    expect(primitive(form, "name").display()).toBe("none");
    expect(primitive(form, "name").disabled()).toBe(true);
    form.set("enabled", true);
    expect(primitive(form, "name").display()).toBe("visible");
    expect(primitive(form, "name").required()).toBe(true);
  });

  it("merges presentation props and swaps components", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        name: {
          type: "string",
          props: { a: 1 },
          "x-reaction": {
            title: "{{ 'Title' }}",
            description: "{{ 'Description' }}",
            props: "{{ ({ b: 2 }) }}",
            component: "{{ ['Select', { size: 'large' }] }}",
          },
        },
      },
    };
    const form = createForm({ schema });
    form.mount();
    const field = primitive(form, "name");
    expect(field.title()).toBe("Title");
    expect(field.description()).toBe("Description");
    expect(field.componentProps()).toEqual({ a: 1, b: 2, size: "large" });
    expect(field.component()).toBe("Select");
  });

  it("updates a data source through an expression", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        role: {
          type: "string",
          "x-reaction": { dataSource: "{{ $enums.roles }}" },
        },
      },
    };
    const roles = [{ label: "Admin", value: "admin" }];
    const form = createForm({ schema, scope: { $enums: { roles } } });
    form.mount();
    expect(primitive(form, "role").dataSource()).toEqual(roles);
  });

  it("sets array rows from a reaction", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: { type: "object", properties: { name: { type: "string" } } },
          "x-reaction": { rows: "{{ $utils.seed() }}" },
        },
      },
    };
    const form = createForm({
      schema,
      scope: { $utils: { seed: () => [{ name: "first" }, { name: "second" }] } },
    });
    form.mount();
    expect(form.get("items[].name")).toEqual(["first", "second"]);
  });

  it("reports invalid targets and expression failures", () => {
    const errors: FormError[] = [];
    const schema: IFormSchema = {
      type: "object",
      properties: {
        group: {
          type: "object",
          properties: { value: { type: "string" } },
          "x-reaction": { value: "{{ 'invalid' }}" },
        },
        name: {
          type: "string",
          "x-reaction": {
            unknown: "{{ 1 }}",
            title: "{{ $utils.fail() }}",
          } as any,
        },
      },
    };
    const form = createForm({
      schema,
      scope: {
        $utils: {
          fail: () => {
            throw new Error("failed");
          },
        },
      },
      onError: (error) => errors.push(error),
    });
    form.mount();
    expect(errors.some((error) => error.message.includes("only valid for primitive"))).toBe(true);
    expect(errors.some((error) => error.message.includes("Unknown x-reaction target"))).toBe(true);
    expect(errors.some((error) => error.message.includes("failed"))).toBe(true);
  });

  it("does not run reactions before mount", () => {
    const call = vi.fn(() => "value");
    const schema: IFormSchema = {
      type: "object",
      properties: {
        name: { type: "string", "x-reaction": { value: "{{ $utils.call() }}" } },
      },
    };
    createForm({ schema, scope: { $utils: { call } } });
    expect(call).not.toHaveBeenCalled();
  });
});
