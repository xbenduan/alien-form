import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Runtime } from "@engine";
import { RuntimeProvider } from "@binding";
import { registerFields } from "./index";
import { complexValueSummary, TableComplexCell } from "./complex-field";

describe("TableComplexCell", () => {
  it("summarizes object and array values", () => {
    expect(complexValueSummary({ name: "A", empty: "" })).toBe("已配置 1 项");
    expect(complexValueSummary([{ name: "A" }, { name: "B" }])).toBe("共 2 项");
    expect(complexValueSummary([])).toBe("—");
  });

  it("renders the complex field schema in detail mode", () => {
    const runtime = new Runtime();
    registerFields(runtime);

    render(
      <RuntimeProvider runtime={runtime}>
        <TableComplexCell
          title="联系人"
          value={{ name: "Alice" }}
          schema={{
            type: "object",
            component: "ObjectField",
            properties: {
              name: { type: "string", title: "姓名", component: "Input" },
            },
          }}
        />
      </RuntimeProvider>,
    );

    expect(screen.getByText("已配置 1 项")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "查看联系人详情" }));
    expect(screen.getByText("联系人详情")).toBeTruthy();
    expect(screen.getByText("姓名")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
  });
});
