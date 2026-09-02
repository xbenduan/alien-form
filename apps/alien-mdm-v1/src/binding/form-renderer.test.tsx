import { act, render } from "@testing-library/react";
import { compileExpr, createForm } from "@alien-form/core";
import { describe, expect, it, vi } from "vitest";
import { Runtime, type CompiledNode, type FieldSchema } from "@engine";
import { FormRenderer } from "./form-renderer";
import { RuntimeProvider } from "./runtime-provider";

describe("FormRenderer", () => {
  it("subscribes to evaluated props without rerendering for unrelated values", () => {
    const runtime = new Runtime();
    const labels: unknown[] = [];
    runtime.component({
      code: "Probe",
      component: ({ label }: { label?: unknown }) => {
        labels.push(label);
        return <span>{String(label)}</span>;
      },
    });

    const targetSchema: FieldSchema = {
      type: "string",
      component: "Probe",
      props: { label: "{{ $values.a }}" },
    };
    const form = createForm({
      schema: {
        type: "object",
        properties: {
          a: { type: "string" },
          b: { type: "string" },
          target: targetSchema,
        },
      },
      initialValues: { a: "A", b: "B", target: "value" },
      scope: runtime.createScope(undefined, {}),
    });
    const mount = vi.spyOn(form, "mount");
    const unmount = vi.spyOn(form, "unmount");
    const node: CompiledNode = {
      key: "target",
      schema: targetSchema,
      props: { label: { expression: compileExpr("{{ $values.a }}") } },
      slots: {},
      children: [],
    };

    const rendered = render(
      <RuntimeProvider runtime={runtime}>
        <FormRenderer form={form} nodes={[node]} />
      </RuntimeProvider>,
    );

    expect(labels).toEqual(["A"]);
    expect(form.getFieldsValueFast()).toEqual({ target: "value" });
    expect(mount).not.toHaveBeenCalled();

    act(() => form.set("b", "B2"));
    expect(labels).toEqual(["A"]);

    act(() => form.set("a", "A2"));
    expect(labels).toEqual(["A", "A2"]);

    rendered.unmount();
    expect(form.getFieldsValueFast()).toEqual({});
    expect(unmount).not.toHaveBeenCalled();
  });
});
