import { StrictMode } from "react";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import { createForm } from "@alien-form/core";
import { FormProvider, SchemaField, useCreateForm } from "../index";
import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

const components = {
  Input: (props: any) => {
    return (
      <input
        data-testid={props["data-testid"] || "input"}
        value={props.value ?? ""}
        onChange={(e) => props.onChange(e.target.value)}
      />
    );
  },
  ArrayView: (props: any) => {
    return (
      <div data-testid="array-view">
        <div data-testid="rows-count">{props.rows?.length || 0}</div>
        <button type="button" data-testid="add" onClick={() => props.onAdd()}>
          Add
        </button>
      </div>
    );
  },
};

describe("Twice to take effect bug in StrictMode", () => {
  it("should update on first click", () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        users: {
          type: "array",
          component: "ArrayView",
          items: {
            type: "object",
            properties: {
              name: { type: "string", component: "Input" },
            },
          },
        },
      },
    });

    const { getByTestId } = render(
      <StrictMode>
        <FormProvider form={form} components={components}>
          <SchemaField
            schema={{
              type: "object",
              properties: {
                users: {
                  type: "array",
                  component: "ArrayView",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", component: "Input" },
                    },
                  },
                },
              },
            }}
          />
        </FormProvider>
      </StrictMode>,
    );

    expect(getByTestId("rows-count").textContent).toBe("0");

    act(() => {
      fireEvent.click(getByTestId("add"));
    });

    expect(getByTestId("rows-count").textContent).toBe("1");

    act(() => {
      fireEvent.click(getByTestId("add"));
    });

    expect(getByTestId("rows-count").textContent).toBe("2");
  });

  it("keeps setup selector effects alive across StrictMode effect replay", () => {
    const listener = vi.fn();
    const schema = {
      type: "object" as const,
      properties: {
        name: { type: "string", component: "Input" },
      },
    };
    const form = createForm({
      setup: (instance) => {
        return instance.effect((current) => current.getField("name")?.value, listener);
      },
    });

    const { getByTestId } = render(
      <StrictMode>
        <FormProvider form={form} components={components}>
          <SchemaField schema={schema} />
        </FormProvider>
      </StrictMode>,
    );

    act(() => {
      fireEvent.change(getByTestId("input"), { target: { value: "Bao" } });
    });

    expect(listener).toHaveBeenCalledWith(
      "Bao",
      undefined,
      expect.objectContaining({
        form,
        stop: expect.any(Function),
      }),
    );
  });

  it("useCreateForm setup effect survives StrictMode double-mount", () => {
    const effectValues: string[] = [];
    const schema = {
      type: "object" as const,
      properties: {
        name: { type: "string", component: "Input", props: { "data-testid": "name-input" } },
        derived: { type: "string", component: "Input", props: { "data-testid": "derived-input" } },
      },
    };

    function TestForm() {
      const form = useCreateForm({
        setup: (f) => {
          const dispose = f.effect(() => {
            const nameField = f.getField("name");
            const derivedField = f.getField("derived");
            if (!nameField || !derivedField) return;
            const val = nameField.value;
            if (val) {
              effectValues.push(val);
              derivedField.setValue(`Hello ${val}`);
            }
          });
          return () => dispose();
        },
      });

      return (
        <FormProvider form={form} components={components}>
          <SchemaField schema={schema} />
        </FormProvider>
      );
    }

    const { getByTestId } = render(
      <StrictMode>
        <TestForm />
      </StrictMode>,
    );

    act(() => {
      fireEvent.change(getByTestId("name-input"), { target: { value: "World" } });
    });

    // The effect should have captured the value
    expect(effectValues).toContain("World");
    // The derived field should be updated
    expect((getByTestId("derived-input") as HTMLInputElement).value).toBe("Hello World");
  });
});
