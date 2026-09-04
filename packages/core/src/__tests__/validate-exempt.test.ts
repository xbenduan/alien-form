import { describe, expect, it } from "vitest";
import { createForm } from "../form";
import type { IFormSchema } from "../types";

/**
 * 回归:required 字段若不可编辑/不可见,不应参与校验。
 *
 * 场景来自动态模型:id 是 required + display:hidden(由后端自动生成),
 * 时间戳常用 display:none 或 disabled(只读)。这些字段用户无从填写,
 * 若纳入必填校验会导致 form.validate() 恒为 false、submit 抛 "Validation failed"。
 */
describe("validate — 豁免 hidden / none / disabled 的必填字段", () => {
  const schemaWith = (idDisplay: "hidden" | "none", extra?: IFormSchema["properties"]): IFormSchema => ({
    type: "object",
    properties: {
      name: { type: "string", component: "Input", required: true },
      id: { type: "string", display: idDisplay, required: true },
      ...extra,
    },
  });

  it("required + display:hidden 的字段不阻塞校验", async () => {
    const form = createForm({ schema: schemaWith("hidden"), initialValues: { name: "Alice" } });
    await expect(form.validate()).resolves.toBe(true);
    expect(form.errors()).toEqual([]);
  });

  it("required + display:none 的字段不阻塞校验", async () => {
    const form = createForm({ schema: schemaWith("none"), initialValues: { name: "Alice" } });
    await expect(form.validate()).resolves.toBe(true);
  });

  it("required + disabled 的字段不阻塞校验", async () => {
    const form = createForm({
      schema: {
        type: "object",
        properties: {
          name: { type: "string", component: "Input", required: true },
          ts: { type: "string", component: "Input", disabled: true, required: true },
        },
      },
      initialValues: { name: "Alice" },
    });
    await expect(form.validate()).resolves.toBe(true);
  });

  it("可见可编辑的 required 字段仍然照常拦截", async () => {
    const form = createForm({ schema: schemaWith("hidden"), initialValues: {} });
    await expect(form.validate()).resolves.toBe(false);
    expect(form.errors().some((e) => e.type === "required")).toBe(true);
  });

  it("submit 在隐藏必填字段存在时正常通过", async () => {
    const form = createForm({ schema: schemaWith("hidden"), initialValues: { name: "Alice" } });
    await expect(form.submit((values) => values)).resolves.toMatchObject({ name: "Alice" });
  });
});
