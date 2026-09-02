import { render, screen } from "@testing-library/react";
import { createForm, type IFormSchema } from "@alien-form/core";
import { describe, expect, it } from "vitest";
import { FormRenderer, RuntimeProvider } from "@binding";
import { Runtime } from "@engine";
import { registerComponents } from "../index";

function renderForm(schema: IFormSchema, initialValues: Record<string, unknown>) {
  const runtime = new Runtime();
  registerComponents(runtime);
  const form = createForm({
    schema,
    initialValues,
    scope: runtime.createScope(undefined, {}),
  });
  return render(
    <RuntimeProvider runtime={runtime}>
      <FormRenderer form={form} />
    </RuntimeProvider>,
  );
}

function closestGridItem(label: string): HTMLElement {
  const item = screen.getByText(label).closest("div");
  if (!item) throw new Error(`Grid item not found: ${label}`);
  return item;
}

describe("complex field grid layout", () => {
  it("inherits ObjectField gridSpan and allows child overrides", () => {
    renderForm(
      {
        type: "object",
        properties: {
          address: {
            type: "object",
            title: "住址信息",
            component: "ObjectField",
            props: { gridSpan: 12 },
            properties: {
              nativePlace: { type: "string", title: "籍贯", component: "Input" },
              currentAddress: { type: "string", title: "现住址", component: "Input" },
              idCardAddress: {
                type: "string",
                title: "身份证住址",
                component: "Input",
                props: { gridSpan: 24 },
              },
            },
          },
        },
      },
      {},
    );

    const fieldset = screen.getByText("住址信息").closest("fieldset");
    const grid = fieldset?.querySelector<HTMLElement>("[style*='--alien-grid-default-span']");
    expect(grid?.style.getPropertyValue("--alien-grid-default-span")).toBe("12");
    expect(closestGridItem("籍贯").style.getPropertyValue("--alien-grid-item-span")).toBe("");
    expect(closestGridItem("现住址").style.getPropertyValue("--alien-grid-item-span")).toBe("");
    expect(closestGridItem("身份证住址").style.getPropertyValue("--alien-grid-item-span")).toBe(
      "24",
    );
  });

  it("inherits ArrayCards gridSpan and allows row field overrides", () => {
    renderForm(
      {
        type: "object",
        properties: {
          records: {
            type: "array",
            title: "学籍信息",
            component: "ArrayCards",
            props: { gridSpan: 12 },
            items: {
              type: "object",
              properties: {
                school: { type: "string", title: "学校", component: "Input" },
                graduationDate: {
                  type: "string",
                  title: "毕业时间",
                  component: "Input",
                  props: { gridSpan: 24 },
                },
              },
            },
          },
        },
      },
      { records: [{ school: "第一中学", graduationDate: "2023-06-30" }] },
    );

    const fieldset = screen.getByText("学籍信息").closest("fieldset");
    const grid = fieldset?.querySelector<HTMLElement>("[style*='--alien-grid-default-span']");
    expect(grid?.style.getPropertyValue("--alien-grid-default-span")).toBe("12");
    expect(closestGridItem("学校").style.getPropertyValue("--alien-grid-item-span")).toBe("");
    expect(closestGridItem("毕业时间").style.getPropertyValue("--alien-grid-item-span")).toBe("24");
  });
});
