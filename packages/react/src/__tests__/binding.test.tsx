import { describe, it, expect, afterEach, vi } from "vitest";
import React from "react";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { createForm } from "@alien-form/core";
import { FormProvider, SchemaField, useForm, useFormState } from "../index";

afterEach(() => {
  cleanup();
});

function Input(props: any) {
  const { value, onChange, loading: _loading, readPretty: _readPretty, ...rest } = props;
  void _loading;
  void _readPretty;
  return <input {...rest} value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} />;
}

function ArrayView(props: any) {
  const { field, rows = [], onAdd, onRemove, readPretty } = props;
  return (
    <div data-testid={`array-${field?.path ?? "unknown"}`}>
      {rows.map((rowFields: React.ReactNode[], index: number) => (
        <div key={index} data-testid={`row-${field?.path ?? "unknown"}-${index}`}>
          {rowFields}
          {!readPretty && (
            <button
              type="button"
              data-testid={`remove-${field?.path ?? "unknown"}-${index}`}
              onClick={() => onRemove?.(index)}
            >
              remove
            </button>
          )}
        </div>
      ))}
      {!readPretty && (
        <button
          type="button"
          data-testid={`add-${field?.path ?? "unknown"}`}
          onClick={() => onAdd?.()}
        >
          add
        </button>
      )}
    </div>
  );
}

const components = { Input, ArrayView };

function buildNameSchema() {
  return {
    type: "object" as const,
    properties: {
      name: { type: "string" as const, component: "Input", props: { "data-testid": "name" } },
    },
  };
}

describe("react bindings", () => {
  it("renders and propagates setValue", () => {
    const form = createForm();
    const schema = buildNameSchema();
    form.setSchema(schema);
    const { getByTestId } = render(
      <FormProvider form={form} components={components}>
        <SchemaField schema={schema} />
      </FormProvider>,
    );
    const input = getByTestId("name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hi" } });
    expect(form.values.name).toBe("hi");
  });

  it("reacts to visibility changes", () => {
    const schema = {
      type: "object" as const,
      properties: {
        age: { type: "number" as const, component: "Input", props: { "data-testid": "age" } },
        adult: {
          type: "string" as const,
          component: "Input",
          props: { "data-testid": "adult" },
          "x-reaction": {
            visible: {
              type: "expression" as const,
              dependencies: { age: "age" },
              expression: "$deps.age >= 18",
            },
          },
        },
      },
    };
    const form = createForm({ initialValues: { age: 10 } });
    const { queryByTestId } = render(
      <FormProvider form={form} components={components}>
        <SchemaField schema={schema} />
      </FormProvider>,
    );
    expect(queryByTestId("adult")).toBeNull();
    act(() => {
      form.setValues({ age: 20 });
    });
    expect(queryByTestId("adult")).not.toBeNull();
  });

  it("renders interactive fields from root definitions $ref", () => {
    const form = createForm();
    const schema = {
      type: "object" as const,
      definitions: {
        profileSection: {
          type: "void" as const,
          properties: {
            name: {
              type: "string" as const,
              component: "Input",
              props: { "data-testid": "ref-name" },
            },
          },
        },
      },
      properties: {
        profile: {
          $ref: "#/definitions/profileSection",
        },
      },
    };

    const { getByTestId } = render(
      <FormProvider form={form} components={components}>
        <SchemaField schema={schema as any} />
      </FormProvider>,
    );

    const input = getByTestId("ref-name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "bao" } });
    expect(form.values.profile.name).toBe("bao");
  });

  it("useFormState triggers rerender", () => {
    const form = createForm();
    const schema = buildNameSchema();
    function StateView() {
      const state = useFormState();
      const f = useForm();
      return (
        <div>
          <span data-testid="name-val">{String(state.values.name ?? "")}</span>
          <button data-testid="set" onClick={() => f.setValues({ name: "x" })} />
        </div>
      );
    }
    const { getByTestId } = render(
      <FormProvider form={form} components={components}>
        <SchemaField schema={schema} />
        <StateView />
      </FormProvider>,
    );
    expect(getByTestId("name-val").textContent).toBe("");
    act(() => {
      fireEvent.click(getByTestId("set"));
    });
    expect(getByTestId("name-val").textContent).toBe("x");
  });

  it("array field push/remove preserves Field identity", () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" } },
          },
        },
      },
    });
    const arr = form.getField("users")!;
    expect(arr).toBeTruthy();
    arr.push({ name: "a" });
    arr.push({ name: "b" });
    arr.push({ name: "c" });
    const row1Before = form.getField("users.1.name")!;
    const row2Before = form.getField("users.2.name")!;
    expect(row1Before).toBeTruthy();
    expect(row2Before).toBeTruthy();
    arr.remove(0);
    const row0After = form.getField("users.0.name")!;
    const row1After = form.getField("users.1.name")!;
    expect(row0After).toBe(row1Before);
    expect(row1After).toBe(row2Before);
    expect(form.values.users).toEqual([{ name: "b" }, { name: "c" }]);
  });

  it("schema replacement updates tree", () => {
    const form = createForm();
    form.setSchema({ type: "object", properties: { a: { type: "string", component: "Input" } } });
    expect(form.getField("a")).toBeTruthy();
    form.setSchema({ type: "object", properties: { b: { type: "string", component: "Input" } } });
    expect(form.getField("a")).toBeUndefined();
    expect(form.getField("b")).toBeTruthy();
  });

  it("destroys form on FormProvider unmount", () => {
    const form = createForm();
    const destroySpy = vi.spyOn(form, "destroy");
    const schema = buildNameSchema();
    form.setSchema(schema);

    const view = render(
      <FormProvider form={form} components={components}>
        <SchemaField schema={schema} />
      </FormProvider>,
    );

    expect(destroySpy).not.toHaveBeenCalled();

    view.unmount();

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it("does not rerender array container on unrelated field changes", () => {
    const form = createForm();
    let arrayRenderCount = 0;
    const ArrayView = ({ rows }: { rows: React.ReactNode[][] }) => {
      arrayRenderCount += 1;
      return <div data-testid="array-size">{rows.length}</div>;
    };
    form.setSchema({
      type: "object",
      properties: {
        title: { type: "string", component: "Input", props: { "data-testid": "title" } },
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
    form.getArrayField("users")?.push({ name: "Bao" });

    const allComponents = { ...components, ArrayView };
    render(
      <FormProvider form={form} components={allComponents}>
        <SchemaField
          schema={{
            type: "object",
            properties: {
              title: { type: "string", component: "Input", props: { "data-testid": "title" } },
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

    const before = arrayRenderCount;
    act(() => {
      form.getField("title")?.setValue("changed");
    });
    expect(arrayRenderCount).toBe(before);
  });

  it("does not rebuild fields when parent rerenders with an equivalent schema object", () => {
    const form = createForm();

    function Wrapper() {
      const [, setTick] = React.useState(0);
      const schema = {
        type: "object" as const,
        properties: {
          name: {
            type: "string" as const,
            component: "Input",
            props: { "data-testid": "name" },
          },
        },
      };

      return (
        <>
          <SchemaField schema={schema} />
          <button data-testid="rerender" onClick={() => setTick((value) => value + 1)} />
        </>
      );
    }

    const { getByTestId } = render(
      <FormProvider form={form} components={components}>
        <Wrapper />
      </FormProvider>,
    );

    const input = getByTestId("name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "persisted" } });
    expect(form.values.name).toBe("persisted");

    act(() => {
      fireEvent.click(getByTestId("rerender"));
    });

    expect((getByTestId("name") as HTMLInputElement).value).toBe("persisted");
    expect(form.values.name).toBe("persisted");
  });

  it("renders nested array fields from initialValues", () => {
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

    const schema = {
      type: "object" as const,
      properties: {
        specs: {
          type: "array" as const,
          component: "ArrayView",
          items: {
            type: "object" as const,
            properties: {
              name: {
                type: "string" as const,
                component: "Input",
                props: { "data-testid": "spec-name" },
              },
              values: {
                type: "array" as const,
                component: "ArrayView",
                items: {
                  type: "object" as const,
                  properties: {
                    label: {
                      type: "string" as const,
                      component: "Input",
                    },
                    image: {
                      type: "string" as const,
                      component: "Input",
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const { getByDisplayValue, getByTestId } = render(
      <FormProvider form={form} components={components}>
        <SchemaField schema={schema} />
      </FormProvider>,
    );

    expect(getByTestId("array-specs.0.values")).toBeTruthy();
    expect(getByDisplayValue("颜色")).toBeTruthy();
    expect(getByDisplayValue("曜石黑")).toBeTruthy();
    expect(getByDisplayValue("月光白")).toBeTruthy();
    expect(form.getField("specs.0.values.0.label")?.value).toBe("曜石黑");
    expect(form.getField("specs.0.values.1.image")?.value).toBe("white.png");
  });

  it("supports adding nested array rows through react bindings", () => {
    const form = createForm({
      initialValues: {
        specs: [
          {
            name: "颜色",
            values: [],
          },
        ],
      },
    });

    const schema = {
      type: "object" as const,
      properties: {
        specs: {
          type: "array" as const,
          component: "ArrayView",
          items: {
            type: "object" as const,
            properties: {
              name: {
                type: "string" as const,
                component: "Input",
              },
              values: {
                type: "array" as const,
                component: "ArrayView",
                items: {
                  type: "object" as const,
                  properties: {
                    label: {
                      type: "string" as const,
                      component: "Input",
                      props: { "data-testid": "nested-label" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const { getByTestId } = render(
      <FormProvider form={form} components={components}>
        <SchemaField schema={schema} />
      </FormProvider>,
    );

    act(() => {
      fireEvent.click(getByTestId("add-specs.0.values"));
    });

    const nestedInput = getByTestId("nested-label") as HTMLInputElement;
    fireEvent.change(nestedInput, { target: { value: "曜石黑" } });

    expect(form.getField("specs.0.values.0.label")).toBeTruthy();
    expect(form.values).toEqual({
      specs: [
        {
          name: "颜色",
          values: [{ label: "曜石黑" }],
        },
      ],
    });
  });
});
