import type { IFormSchema, RuntimeRuleHandler } from "@alien-form/core";
import { SchemaForm } from "@alien-form/shared";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

const editSchema: IFormSchema = {
  type: "object",
  properties: {
    customerName: {
      type: "string",
      component: "Input",
      decorator: "FormItem",
      props: { placeholder: "请输入编辑姓名" },
    },
  },
};

const schema: IFormSchema = {
  type: "object",
  properties: {
    customerName: {
      type: "string",
      title: "客户姓名",
      component: "Input",
      decorator: "FormItem",
      props: { placeholder: "请输入客户姓名" },
    },
    phone: {
      type: "string",
      title: "联系电话",
      component: "Input",
      decorator: "FormItem",
      props: { placeholder: "请输入联系电话" },
    },
    serviceId: {
      type: "string",
      title: "服务项目",
      component: "Select",
      decorator: "FormItem",
      props: { placeholder: "请选择服务项目" },
      "x-reaction": { dataSource: "@loadDataSource" },
    },
    employeeId: {
      type: "string",
      title: "服务员工",
      component: "Select",
      decorator: "FormItem",
      props: { placeholder: "请选择服务员工" },
      "x-reaction": { dataSource: "@loadDataSource" },
    },
  },
};

describe("SchemaForm record integration", () => {
  it("recreates edit forms only when the record identity changes", () => {
    function Harness() {
      const [record, setRecord] = useState<Record<string, unknown>>();

      return (
        <App>
          <button onClick={() => setRecord({ id: "record-1", customerName: "张三" })}>
            加载记录
          </button>
          <button onClick={() => setRecord({ id: "record-1", customerName: "后台值" })}>
            刷新当前记录
          </button>
          <button onClick={() => setRecord({ id: "record-2", customerName: "李四" })}>
            切换记录
          </button>
          <SchemaForm
            mode="edit"
            formKey={`nail-booking:edit:${String(record?.id ?? "record-1")}`}
            schema={editSchema}
            initialValues={record}
          />
        </App>
      );
    }

    render(<Harness />);
    expect(screen.queryByPlaceholderText("请输入编辑姓名")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "加载记录" }));
    const input = screen.getByPlaceholderText("请输入编辑姓名") as HTMLInputElement;
    expect(input.value).toBe("张三");

    fireEvent.change(input, { target: { value: "用户编辑值" } });
    fireEvent.click(screen.getByRole("button", { name: "刷新当前记录" }));
    expect((screen.getByPlaceholderText("请输入编辑姓名") as HTMLInputElement).value).toBe(
      "用户编辑值",
    );

    fireEvent.click(screen.getByRole("button", { name: "切换记录" }));
    expect((screen.getByPlaceholderText("请输入编辑姓名") as HTMLInputElement).value).toBe("李四");
  });

  it("keeps current values when an async reaction updates select options", async () => {
    let releaseOptions: () => void = () => undefined;
    const optionsReady = new Promise<void>((resolve) => {
      releaseOptions = resolve;
    });
    const onSubmit = vi.fn();

    function Harness() {
      const [optionsLoaded, setOptionsLoaded] = useState(false);
      const loadDataSource: RuntimeRuleHandler = async (ctx) => {
        await optionsReady;
        setOptionsLoaded(true);
        return ctx.path === "serviceId"
          ? [{ label: "基础护理", value: "service-1" }]
          : [{ label: "Luna", value: "employee-1" }];
      };

      return (
        <App>
          {optionsLoaded ? <span data-testid="options-loaded" /> : null}
          <SchemaForm
            mode="add"
            formKey="nail-booking:add:new"
            schema={schema}
            handlers={{ loadDataSource }}
            actions={{ onSubmit }}
          />
        </App>
      );
    }

    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText("请输入客户姓名"), {
      target: { value: "张三" },
    });
    fireEvent.change(screen.getByPlaceholderText("请输入联系电话"), {
      target: { value: "13800138000" },
    });

    await act(async () => {
      releaseOptions();
      await optionsReady;
    });
    await screen.findByTestId("options-loaded");

    const selects = screen.getAllByRole("combobox");
    fireEvent.mouseDown(selects[0]!);
    fireEvent.click(await screen.findByText("基础护理"));
    fireEvent.mouseDown(selects[1]!);
    fireEvent.click(await screen.findByText("Luna"));

    expect((screen.getByPlaceholderText("请输入客户姓名") as HTMLInputElement).value).toBe("张三");
    expect((screen.getByPlaceholderText("请输入联系电话") as HTMLInputElement).value).toBe(
      "13800138000",
    );

    fireEvent.click(screen.getByRole("button", { name: "创建记录" }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        {
          customerName: "张三",
          phone: "13800138000",
          serviceId: "service-1",
          employeeId: "employee-1",
        },
        "add",
      );
    });
  });
});
