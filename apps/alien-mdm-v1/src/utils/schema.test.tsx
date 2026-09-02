import { render, screen } from "@testing-library/react";
import type { ColumnType } from "antd/es/table";
import { describe, expect, it } from "vitest";
import { Runtime } from "@engine";
import { registerFields } from "../register/global/fields";
import { schemaToColumns } from "./schema";

describe("schemaToColumns", () => {
  it("renders registered leaf and complex field components", () => {
    const runtime = new Runtime();
    registerFields(runtime);
    const columns = schemaToColumns(runtime)(
      {
        type: "object",
        properties: {
          name: { type: "string", title: "名称", component: "Input" },
          profile: { type: "object", title: "资料", component: "ObjectField" },
          contacts: { type: "array", title: "联系人", component: "ArrayCards" },
        },
      },
      "customer",
    ) as ColumnType<Record<string, unknown>>[];

    render(
      <>
        {columns[0]?.render?.("Alice", {}, 0)}
        {columns[1]?.render?.({ age: 30 }, {}, 0)}
        {columns[2]?.render?.([{ name: "Alice" }], {}, 0)}
      </>,
    );

    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("已配置 1 项")).toBeTruthy();
    expect(screen.getByText("共 1 项")).toBeTruthy();
    expect(screen.getByRole("button", { name: "查看资料详情" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "查看联系人详情" })).toBeTruthy();
  });

  it("uses the component registered for the current domain", () => {
    const runtime = new Runtime();
    let receivedProps: Record<string, unknown> | undefined;
    runtime.component({
      code: "Input",
      component: ({ value }: { value?: unknown }) => <>global:{String(value)}</>,
    });
    runtime.component(
      {
        code: "Input",
        component: (props: Record<string, unknown>) => {
          receivedProps = props;
          return <>domain:{String(props.value)}</>;
        },
      },
      "customer",
    );
    const [column] = schemaToColumns(runtime)(
      {
        type: "object",
        properties: { name: { type: "string", component: "Input" } },
      },
      "customer",
    ) as ColumnType<Record<string, unknown>>[];

    render(<>{column?.render?.("Alice", {}, 0)}</>);
    expect(screen.getByText("domain:Alice")).toBeTruthy();
    expect(receivedProps).toMatchObject({
      value: "Alice",
      mode: "detail",
      isTable: true,
      domain: "customer",
    });
  });
});
