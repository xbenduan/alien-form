import { describe, it, expect } from "vitest";
import { createForm } from "../src";
import type { IFormSchema, Handlers } from "../src";

describe("createForm / buildTree - 构建与初始值注入", () => {
  it("按 properties 构建字段树，values 组合叶子值", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        name: { type: "string", default: "n" },
        age: { type: "number", default: 1 },
      },
    };
    const form = createForm({ schema });
    expect(form.values()).toEqual({ name: "n", age: 1 });
  });

  it("initialValues 覆盖 default", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: { name: { type: "string", default: "n" } },
    };
    const form = createForm({ schema, initialValues: { name: "x" } });
    expect(form.values()).toEqual({ name: "x" });
  });

  it("input-format 在初始值注入时跑一次（外→内）", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        amount: { type: "number", "x-format": { input: "@centsToYuan" } },
      },
    };
    const handlers: Handlers = {
      formats: { centsToYuan: (v: number) => v / 100 },
    };
    const form = createForm({ schema, initialValues: { amount: 1000 }, handlers });
    expect(form.values()).toEqual({ amount: 10 });
  });

  it("嵌套 object 结构递归构建", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        group: {
          type: "object",
          properties: { a: { type: "number", default: 3 } },
        },
      },
    };
    const form = createForm({ schema });
    expect(form.values()).toEqual({ group: { a: 3 } });
  });

  it("void 字段摊平到父级数据层", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        layout: {
          type: "void",
          properties: { inner: { type: "number", default: 8 } },
        },
      },
    };
    const form = createForm({ schema });
    expect(form.values()).toEqual({ inner: 8 });
  });

  it("array 按初始值长度生成行", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        list: {
          type: "array",
          items: { type: "object", properties: { v: { type: "number" } } },
        },
      },
    };
    const form = createForm({ schema, initialValues: { list: [{ v: 1 }, { v: 2 }] } });
    expect(form.values()).toEqual({ list: [{ v: 1 }, { v: 2 }] });
  });

  it("hasRequired 点亮 required signal", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        t: { type: "string", "x-validators": [{ required: true }] },
      },
    };
    const form = createForm({ schema });
    expect(form.field("t")?.required()).toBe(true);
  });
});

describe("Form.field - 按 path 定位", () => {
  it("绝对 path 命中字段实例", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        group: {
          type: "object",
          properties: { a: { type: "number", default: 3 } },
        },
      },
    };
    const form = createForm({ schema });
    expect(form.field("group.a")?.value()).toBe(3);
  });

  it("未命中返回 undefined", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: { a: { type: "string" } },
    };
    const form = createForm({ schema });
    expect(form.field("nope.deep")).toBeUndefined();
  });
});

describe("Form.setValues - 批量下发", () => {
  it("按结构递归匹配下发到叶子", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        a: { type: "number" },
        b: { type: "string" },
      },
    };
    const form = createForm({ schema });
    form.setValues({ a: 1, b: "x" });
    expect(form.values()).toEqual({ a: 1, b: "x" });
  });

  it("setValues 跑 input-format", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        amount: { type: "number", "x-format": { input: "@half" } },
      },
    };
    const form = createForm({
      schema,
      handlers: { formats: { half: (v: number) => v / 2 } },
    });
    form.setValues({ amount: 10 });
    expect(form.values()).toEqual({ amount: 5 });
  });
});

describe("Form.reset", () => {
  it("递归回落到 default", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: { n: { type: "number", default: 7 } },
    };
    const form = createForm({ schema });
    (form.field("n") as any).setValue(99);
    form.reset();
    expect(form.values()).toEqual({ n: 7 });
  });
});

describe("Form.validate / errors / valid", () => {
  it("对象规则 required 校验失败聚合到 errors", async () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        title: {
          type: "string",
          "x-validators": [{ required: true, message: "必填" }],
        },
      },
    };
    const form = createForm({ schema });
    const ok = await form.validate();
    expect(ok).toBe(false);
    expect(form.valid()).toBe(false);
    expect(form.errors()[0].message).toBe("必填");
  });

  it("校验通过后 valid 为 true", async () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        title: { type: "string", "x-validators": [{ required: true }] },
      },
    };
    const form = createForm({ schema });
    (form.field("title") as any).setValue("ok");
    const ok = await form.validate();
    expect(ok).toBe(true);
    expect(form.valid()).toBe(true);
  });

  it("display:none 字段不参与校验", async () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        hidden: {
          type: "string",
          display: "none",
          "x-validators": [{ required: true }],
        },
      },
    };
    const form = createForm({ schema });
    expect(await form.validate()).toBe(true);
  });
});

describe("Form.getFormattedValues / submit - output-format", () => {
  it("getFormattedValues 跑 output-format（内→外）", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        amount: { type: "number", default: 10, "x-format": { output: "@x100" } },
      },
    };
    const form = createForm({
      schema,
      handlers: { formats: { x100: (v: number) => v * 100 } },
    });
    expect(form.getFormattedValues()).toEqual({ amount: 1000 });
    // values 仍是内部值
    expect(form.values()).toEqual({ amount: 10 });
  });

  it("submit = validate 通过 → getFormattedValues → onSubmit", async () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        amount: {
          type: "number",
          default: 10,
          "x-format": { output: "@x100" },
          "x-validators": [{ required: true }],
        },
      },
    };
    const form = createForm({
      schema,
      handlers: { formats: { x100: (v: number) => v * 100 } },
    });
    const payload = await form.submit(async (v) => v);
    expect(payload).toEqual({ amount: 1000 });
  });

  it("submit 校验不过则抛出，且 submitting 复位", async () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        title: { type: "string", "x-validators": [{ required: true }] },
      },
    };
    const form = createForm({ schema });
    await expect(form.submit()).rejects.toBeTruthy();
    expect(form.submitting()).toBe(false);
  });
});

describe("Form 生命周期 - mount/unmount 联动", () => {
  it("mount 后 x-reactions 生效", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        src: { type: "string", default: "a" },
        dst: {
          type: "string",
          "x-reactions": [{ target: "title", rule: "{{ src }}" }],
        },
      },
    };
    const form = createForm({ schema });
    form.mount();
    expect(form.field("dst")?.title()).toBe("a");
  });

  it("reaction 随依赖变化重新求值", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        src: { type: "string", default: "a" },
        dst: {
          type: "string",
          "x-reactions": [{ target: "title", rule: "{{ src }}" }],
        },
      },
    };
    const form = createForm({ schema });
    form.mount();
    (form.field("src") as any).setValue("b");
    expect(form.field("dst")?.title()).toBe("b");
  });

  it("未 mount 时联动不生效", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        src: { type: "string", default: "a" },
        dst: {
          type: "string",
          "x-reactions": [{ target: "title", rule: "{{ src }}" }],
        },
      },
    };
    const form = createForm({ schema });
    expect(form.field("dst")?.title()).toBe("");
  });

  it("unmount 后联动停止", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        src: { type: "string", default: "a" },
        dst: {
          type: "string",
          "x-reactions": [{ target: "title", rule: "{{ src }}" }],
        },
      },
    };
    const form = createForm({ schema });
    form.mount();
    expect(form.field("dst")?.title()).toBe("a");
    form.unmount();
    (form.field("src") as any).setValue("b");
    expect(form.field("dst")?.title()).toBe("a");
  });

  it("重复 mount 幂等", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: { a: { type: "string", default: "x" } },
    };
    const form = createForm({ schema });
    form.mount();
    expect(() => form.mount()).not.toThrow();
  });
});

describe("选择器与路径联动", () => {
  it("相对 ./sibling 选择器求值", () => {
    const schema: IFormSchema = {
      type: "object",
      properties: {
        group: {
          type: "object",
          properties: {
            a: { type: "number", default: 3 },
            b: {
              type: "number",
              "x-reactions": [
                { target: "title", rule: "{{ $get('./a') * 2 }}" },
              ],
            },
          },
        },
      },
    };
    const form = createForm({ schema });
    form.mount();
    expect(form.field("group.b")?.title()).toBe(6 as any);
  });
});
