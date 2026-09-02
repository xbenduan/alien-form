import { act, renderHook } from "@testing-library/react";
import { createForm, signal, type PrimitiveFieldNode } from "@alien-form/core";
import { describe, expect, it } from "vitest";
import { shallowEqual, useFieldSnapshot, useSignalSnapshot } from "../index";

function readField(field: PrimitiveFieldNode) {
  return {
    value: field.value(),
    disabled: field.disabled(),
    title: field.title(),
  };
}

describe("signal snapshots", () => {
  it("aggregates multiple field signals into one reactive snapshot", () => {
    const form = createForm({
      schema: {
        type: "object",
        properties: {
          name: { type: "string", title: "Name" },
        },
      },
      initialValues: { name: "Alien" },
    });
    const field = form.field("name") as PrimitiveFieldNode;
    const { result } = renderHook(() => useFieldSnapshot(field, readField));

    expect(result.current).toEqual({
      value: "Alien",
      disabled: false,
      title: "Name",
    });

    act(() => {
      field.setValue("Human");
      field.setDisabled(true);
    });

    expect(result.current).toEqual({
      value: "Human",
      disabled: true,
      title: "Name",
    });
  });

  it("does not rerender when a derived snapshot stays shallowly equal", () => {
    const source = signal({ selected: 1, ignored: 1 });
    const read = () => ({ selected: source().selected });
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useSignalSnapshot(read, shallowEqual);
    });

    const initial = result.current;
    act(() => source({ selected: 1, ignored: 2 }));
    expect(result.current).toBe(initial);
    expect(renders).toBe(1);

    act(() => source({ selected: 2, ignored: 2 }));
    expect(result.current).toEqual({ selected: 2 });
    expect(renders).toBe(2);
  });
});
