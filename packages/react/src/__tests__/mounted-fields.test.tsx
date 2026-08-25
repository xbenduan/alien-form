import { render, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { IFormSchema } from "@alien-form/core";
import { createForm, FormProvider, SchemaField } from "../index";

const Input = (props: { value?: string; onChange?: (v: string) => void }) => (
  <input value={props.value ?? ""} onChange={(e) => props.onChange?.(e.target.value)} />
);

const schema: IFormSchema = {
  type: "object",
  properties: {
    a: { type: "string" },
    b: { type: "string" },
  },
};

function renderForm(form: ReturnType<typeof createForm>) {
  return render(
    <FormProvider form={form} components={{ Input }}>
      <SchemaField />
    </FormProvider>,
  );
}

describe("mounted field registration (React wiring)", () => {
  it("registers rendered fields so getFieldsValueFast returns their values", () => {
    const form = createForm({ schema, initialValues: { a: "1", b: "2" } });
    expect(form.getFieldsValueFast()).toEqual({});
    renderForm(form);
    expect(form.getFieldsValueFast()).toEqual({ a: "1", b: "2" });
  });

  it("unregisters fields on unmount", () => {
    const form = createForm({ schema, initialValues: { a: "1", b: "2" } });
    const rendered = renderForm(form);
    expect(form.getFieldsValueFast()).toEqual({ a: "1", b: "2" });
    rendered.unmount();
    expect(form.getFieldsValueFast()).toEqual({});
  });

  it("validateFast only validates mounted fields", async () => {
    const failingSchema: IFormSchema = {
      type: "object",
      properties: {
        a: { type: "string", required: true },
        b: { type: "string", required: true },
      },
    };
    const form = createForm({ schema: failingSchema });
    form.mount();
    renderForm(form);
    const ok = await act(async () => form.validateFast());
    expect(ok).toBe(false);
    expect(form.field("a")?.errors().length).toBeGreaterThan(0);
    expect(form.field("b")?.errors().length).toBeGreaterThan(0);
  });
});
