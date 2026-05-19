import { render, fireEvent, act } from "@testing-library/react";
import { createForm } from "@alien-form/core";
import { FormProvider, SchemaField } from "../index";
import { describe, it, expect } from "vitest";

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

describe("Twice to take effect bug", () => {
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
      </FormProvider>,
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
});
