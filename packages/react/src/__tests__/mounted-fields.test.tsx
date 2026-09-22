import { render, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { createForm } from "@alien-form/core";
import { compileForm, defineComponent, defineUtil, Runtime } from "@alien-form/engine";
import { FormProvider, FormRenderer, RuntimeProvider, useFieldValue } from "../index";

const Input = (props: { value?: string; onChange?: (v: string) => void }) => (
  <input value={props.value ?? ""} onChange={(e) => props.onChange?.(e.target.value)} />
);
const Probe = (props: { filterFields?: unknown }) => (
  <span data-testid="filter-fields-type">{typeof props.filterFields}</span>
);

const fieldSchema = {
  properties: {
    a: { type: "string" },
    b: { type: "string" },
  },
};

function createRuntime() {
  const runtime = new Runtime();
  runtime.component("Input", defineComponent(Input, { injectContext: true }));
  runtime.component("Probe", defineComponent(Probe, { injectContext: true }));
  runtime.component(
    "FormItem",
    defineComponent(({ children }: { children?: ReactNode }) => <>{children}</>, {
      injectContext: true,
    }),
  );
  return runtime;
}

function renderForm(form: ReturnType<typeof createForm>, runtime: Runtime, nodes: any[]) {
  return render(
    <RuntimeProvider runtime={runtime}>
      <FormRenderer form={form} nodes={nodes} />
    </RuntimeProvider>,
  );
}

describe("mounted field registration (React wiring)", () => {
  it("updates array-path hooks when a row field is created", () => {
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
    const ValueProbe = () => (
      <span data-testid="array-value">{String(useFieldValue(["items", 0, "name"]) ?? "")}</span>
    );
    const rendered = render(
      <FormProvider form={form}>
        <ValueProbe />
      </FormProvider>,
    );

    expect(rendered.getByTestId("array-value").textContent).toBe("");
    const items = form.field("items");
    if (items?.kind !== "array") throw new Error("items must be an array field");
    act(() => items.push({ name: "first" }));
    expect(rendered.getByTestId("array-value").textContent).toBe("first");
  });

  it("registers rendered fields so getFieldsValueFast returns their values", () => {
    const compiled = compileForm(fieldSchema, { "form-schema": { type: "object" } });
    const form = createForm({
      schema: compiled.schema,
      initialValues: { a: "1", b: "2" },
    });
    const runtime = createRuntime();
    expect(form.getFieldsValueFast()).toEqual({});
    renderForm(form, runtime, compiled.nodes);
    expect(form.getFieldsValueFast()).toEqual({ a: "1", b: "2" });
  });

  it("unregisters fields on unmount", () => {
    const compiled = compileForm(fieldSchema, { "form-schema": { type: "object" } });
    const form = createForm({ schema: compiled.schema, initialValues: { a: "1", b: "2" } });
    const rendered = renderForm(form, createRuntime(), compiled.nodes);
    expect(form.getFieldsValueFast()).toEqual({ a: "1", b: "2" });
    rendered.unmount();
    expect(form.getFieldsValueFast()).toEqual({});
  });

  it("validateFast only validates mounted fields", async () => {
    const failingSchema = {
      properties: {
        a: { type: "string", required: true },
        b: { type: "string", required: true },
      },
    };
    const compiled = compileForm(failingSchema, { "form-schema": { type: "object" } });
    const form = createForm({ schema: compiled.schema });
    form.mount();
    renderForm(form, createRuntime(), compiled.nodes);
    const ok = await act(async () => form.validateFast());
    expect(ok).toBe(false);
    expect(form.field("a")?.errors().length).toBeGreaterThan(0);
    expect(form.field("b")?.errors().length).toBeGreaterThan(0);
  });

  it("keeps compiled expression results when field props still contain raw expressions", () => {
    const compiled = compileForm(
      {
        properties: {
          filterFields: {
            type: "string",
            component: "Probe",
            props: {
              filterFields: "{{ $utils.load }}",
            },
          },
        },
      },
      { "form-schema": { type: "object" } },
    );
    const runtime = createRuntime();
    runtime.util(
      "load",
      defineUtil(() => [], { description: "加载" }),
    );
    const form = createForm({
      schema: compiled.schema,
      scope: runtime.createScope(undefined, {}),
    });
    const rendered = renderForm(form, runtime, compiled.nodes);
    expect(rendered.container.querySelector("[data-testid=filter-fields-type]")?.textContent).toBe(
      "function",
    );
  });
});
