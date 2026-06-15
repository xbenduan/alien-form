import { StrictMode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { FormConfig, IFormSchema } from "@alien-form/core";
import { useCreateForm } from "../index";

const schemaA: IFormSchema = {
  type: "object",
  properties: { name: { type: "string", required: true } },
};
const schemaB: IFormSchema = {
  type: "object",
  properties: { age: { type: "number" } },
};

function configFor(schema: IFormSchema): FormConfig {
  return { schema };
}

describe("useCreateForm", () => {
  it("deps 变化时创建新实例并销毁旧实例", () => {
    const { result, rerender } = renderHook(
      ({ schema, key }: { schema: IFormSchema; key: number }) =>
        useCreateForm(configFor(schema), [key]),
      { initialProps: { schema: schemaA, key: 1 } },
    );

    const formA = result.current;
    const destroySpy = vi.spyOn(formA, "destroy");

    rerender({ schema: schemaB, key: 2 });

    const formB = result.current;
    expect(formB).not.toBe(formA);
    expect(destroySpy).toHaveBeenCalledTimes(1);
    // 新实例可用：字段树已构建
    expect(formB.field("age")).toBeDefined();
  });

  it("deps 不变时复用同一实例，不销毁", () => {
    const { result, rerender } = renderHook(
      ({ schema, key }: { schema: IFormSchema; key: number }) =>
        useCreateForm(configFor(schema), [key]),
      { initialProps: { schema: schemaA, key: 1 } },
    );

    const formA = result.current;
    const destroySpy = vi.spyOn(formA, "destroy");

    rerender({ schema: schemaA, key: 1 });

    expect(result.current).toBe(formA);
    expect(destroySpy).not.toHaveBeenCalled();
  });

  it("StrictMode 重挂后实例仍存活可用", () => {
    const { result } = renderHook(
      () => useCreateForm(configFor(schemaA), [1]),
      { wrapper: StrictMode },
    );

    const form = result.current;
    // 经历 mount -> unmount -> remount 后字段树仍在，未被销毁
    expect(form.field("name")).toBeDefined();
    form.set("name", "alien");
    expect(form.values()).toMatchObject({ name: "alien" });
  });

  it("组件卸载不抛错", () => {
    const { unmount } = renderHook(() => useCreateForm(configFor(schemaA), [1]));
    expect(() => unmount()).not.toThrow();
  });

  it("透传 config.definitions 到 core createForm，并仅通过显式 $ref 生效", async () => {
    const { result } = renderHook(() =>
      useCreateForm(
        {
          schema: {
            type: "object",
            properties: {
              name: { $ref: "#/definitions/HookName" },
            },
          },
          initialValues: { name: "alien" },
          definitions: {
            HookName: { type: "string", "x-validate": () => ({ message: "from hook definitions" }) },
          },
        },
        [1],
      ),
    );

    await expect(result.current.validate()).resolves.toBe(false);
    expect(result.current.field("name")?.errors()).toEqual([{ message: "from hook definitions", type: "x-validate" }]);
  });
});
