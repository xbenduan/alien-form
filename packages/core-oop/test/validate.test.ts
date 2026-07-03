import { describe, it, expect } from "vitest";
import { runValidators, hasRequired } from "../src/runtime/validate";
import { createContext } from "../src/runtime/context";
import type { FieldLike, RuntimeContext, ValidatorRule } from "../src/schema";

function makeCtx(selfValue?: any): RuntimeContext {
  const self: FieldLike = { path: "f", value: () => selfValue };
  return createContext({
    root: { path: "", value: () => ({}), children: new Map() } as any,
    self,
    userScope: {},
    handlers: {
      validators: {
        checkOk: (v: string) => (v === "ok" ? true : "无效"),
      },
    },
    onError: () => {},
  });
}

describe("hasRequired", () => {
  // 契约：任一对象规则含 required: true 时返回 true。
  it("undefined → false", () => {
    expect(hasRequired(undefined)).toBe(false);
  });
  it("含 required:true → true", () => {
    expect(hasRequired([{ required: true }])).toBe(true);
  });
  it("required:false → false", () => {
    expect(hasRequired([{ required: false }])).toBe(false);
  });
  it("非对象规则（表达式）→ false", () => {
    expect(hasRequired(["{{ $value >= 0 }}"])).toBe(false);
  });
});

describe("runValidators - 对象规则", () => {
  // 契约：依次检查 required / max / min / pattern；不过用 message 或内置默认文案；错误全收集不短路。
  it("required 空值 → 默认文案", async () => {
    const errs = await runValidators([{ required: true }], "", "f", makeCtx());
    expect(errs).toEqual([{ path: "f", message: "此项为必填项" }]);
  });

  it("required 提供 message → 用自定义文案", async () => {
    const errs = await runValidators(
      [{ required: true, message: "必填" }],
      undefined,
      "f",
      makeCtx(),
    );
    expect(errs[0].message).toBe("必填");
  });

  it("非必填空值跳过后续度量校验", async () => {
    const errs = await runValidators([{ max: 3 }], "", "f", makeCtx());
    expect(errs).toEqual([]);
  });

  it("字符串 max 作用于 length", async () => {
    const errs = await runValidators([{ max: 3 }], "abcd", "f", makeCtx());
    expect(errs[0].message).toBe("不得大于 3");
  });

  it("number min 作用于数值本身", async () => {
    const errs = await runValidators([{ min: 10 }], 5, "f", makeCtx());
    expect(errs[0].message).toBe("不得小于 10");
  });

  it("数组 max 作用于 length", async () => {
    const errs = await runValidators([{ max: 1 }], [1, 2], "f", makeCtx());
    expect(errs[0].message).toBe("不得大于 1");
  });

  it("pattern 不匹配 → 格式不正确", async () => {
    const errs = await runValidators(
      [{ pattern: "^\\d+$" }],
      "ab",
      "f",
      makeCtx(),
    );
    expect(errs[0].message).toBe("格式不正确");
  });

  it("pattern 匹配 → 通过", async () => {
    const errs = await runValidators(
      [{ pattern: "^\\d+$" }],
      "123",
      "f",
      makeCtx(),
    );
    expect(errs).toEqual([]);
  });

  it("多条规则错误全部收集，不短路", async () => {
    const rules: ValidatorRule[] = [{ required: true }, { max: 2 }];
    // 空值：required 失败；max 因空值被跳过 → 仅一条
    const errs = await runValidators(rules, "", "f", makeCtx());
    expect(errs.length).toBe(1);
  });
});

describe("runValidators - SchemaRule 规则", () => {
  // 契约：true/undefined 通过；false → "校验未通过"；string → 文案。
  it("表达式返回 true 通过", async () => {
    const errs = await runValidators(["{{ $value >= 0 }}"], 1, "f", makeCtx(1));
    expect(errs).toEqual([]);
  });

  it("表达式返回 false → 校验未通过", async () => {
    const errs = await runValidators(
      ["{{ $value >= 0 }}"],
      -1,
      "f",
      makeCtx(-1),
    );
    expect(errs[0].message).toBe("校验未通过");
  });

  it("@name 处理器返回文案", async () => {
    const errs = await runValidators(["@checkOk"], "bad", "f", makeCtx("bad"));
    expect(errs[0].message).toBe("无效");
  });

  it("@name 处理器返回 true 通过", async () => {
    const errs = await runValidators(["@checkOk"], "ok", "f", makeCtx("ok"));
    expect(errs).toEqual([]);
  });
});
