import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AboutPage from "./AboutPage";

function renderPage() {
  return render(<AboutPage />);
}

describe("AboutPage", () => {
  it("默认展示演练场", async () => {
    renderPage();

    expect(screen.getByText("AlienForm 学习中心")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "演练场" })).toBeTruthy();
    expect(screen.getByText(/实时修改 Schema/)).toBeTruthy();
  });

  it("支持切换多个学习标签页", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "项目介绍" }));
    await screen.findByText("AlienForm: 用一份 Schema 驱动整个后台");

    fireEvent.click(screen.getByRole("tab", { name: "指南" }));
    await screen.findByText("按 Formily 学习路径快速入门");

    fireEvent.click(screen.getByRole("tab", { name: "场景案例" }));
    await screen.findByText(/角色权限联动/);

    fireEvent.click(screen.getByRole("tab", { name: "进阶指南" }));
    await screen.findByText(/数据访问抽象: provider 与 API 函数/);
  });

  it("在场景案例里触发并恢复自定义校验", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "场景案例" }));
    await screen.findByText(/角色权限联动/);

    fireEvent.click(screen.getByRole("button", { name: "触发校验" }));
    await screen.findByText("昵称至少需要 3 个字符");

    fireEvent.change(screen.getByPlaceholderText("请输入昵称"), {
      target: { value: "abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "触发校验" }));

    await waitFor(() => {
      expect(screen.queryByText("昵称至少需要 3 个字符")).toBeNull();
    });
  });

  it("在演练场中提示非法 Schema 并支持恢复", async () => {
    const { container } = renderPage();
    const schemaEditor = container.querySelector("textarea");

    expect(schemaEditor).toBeTruthy();

    fireEvent.change(schemaEditor!, {
      target: { value: "{" },
    });

    await waitFor(() => {
      expect(container.textContent).toContain("SyntaxError");
    });

    fireEvent.change(schemaEditor!, {
      target: {
        value: JSON.stringify(
          {
            type: "object",
            properties: {
              email: {
                type: "string",
                title: "邮箱",
                component: "Input",
                decorator: "FormItem",
                props: { placeholder: "请输入邮箱" },
                required: true,
              },
            },
          },
          null,
          2,
        ),
      },
    });

    await waitFor(() => {
      expect(container.textContent).not.toContain("SyntaxError");
    });
    expect(screen.getByPlaceholderText("请输入邮箱")).toBeTruthy();
  });

  it("在演练场中提交表单并支持重置", async () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText("请输入姓名"), {
      target: { value: "张三" },
    });
    fireEvent.click(screen.getByRole("button", { name: /提\s*交/ }));

    await screen.findByText(/"name": "张三"/);

    fireEvent.click(screen.getByRole("button", { name: /重\s*置/ }));

    await screen.findByText("暂无数据");
    expect((screen.getByPlaceholderText("请输入姓名") as HTMLInputElement).value).toBe("");
  });
});
