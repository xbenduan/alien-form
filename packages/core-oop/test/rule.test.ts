import { describe, it, expect } from "vitest";
import { executeRule } from "../src/runtime/rule";
import { createContext } from "../src/runtime/context";
import type { FieldLike, Handlers, RuntimeContext } from "../src/schema";

/** 构造一个最小 RuntimeContext，self.value() 返回给定内部值。 */
function makeCtx(opts: {
  selfValue?: any;
  userScope?: Record<string, any>;
  handlers?: Handlers;
}): RuntimeContext {
  const self: FieldLike = {
    path: "self",
    value: () => opts.selfValue,
  };
  const root: FieldLike = {
    path: "",
    value: () => ({}),
    children: new Map(),
  } as any;
  return createContext({
    root,
    self,
    userScope: opts.userScope ?? {},
    handlers: opts.handlers ?? {},
    onError: () => {},
  });
}

describe("executeRule", () => {
  // 契约：函数直接调用；"{{expr}}" 编译求值；"@name" 查对应命名空间；其余字面量原样返回。
  it("函数 rule 直接以 ctx 调用", () => {
    const ctx = makeCtx({});
    const rule = (c: RuntimeContext) => c.userScope;
    expect(executeRule(rule, ctx, "reactions")).toBe(ctx.userScope);
  });

  it("{{expr}} 表达式在 reactions 命名空间求值（读 $value）", () => {
    const ctx = makeCtx({ selfValue: 5 });
    expect(executeRule("{{ $value * 2 }}", ctx, "reactions")).toBe(10);
  });

  it("formats 命名空间下 $value 为传入的入参而非字段现值", () => {
    const ctx = makeCtx({ selfValue: 999 });
    expect(executeRule("{{ $value + 1 }}", ctx, "formats", 100)).toBe(101);
  });

  it("@name 在 reactions 命名空间查 handlers.reactions，签名 (ctx)", () => {
    const ctx = makeCtx({
      handlers: { reactions: { double: (c) => (c.self.value() as number) * 2 } },
      selfValue: 4,
    });
    expect(executeRule("@double", ctx, "reactions")).toBe(8);
  });

  it("@name 在 formats 命名空间查 handlers.formats，签名 (value, ctx)", () => {
    const ctx = makeCtx({
      handlers: { formats: { inc: (v: number) => v + 1 } },
    });
    expect(executeRule("@inc", ctx, "formats", 41)).toBe(42);
  });

  it("@name 未注册处理器返回 undefined", () => {
    const ctx = makeCtx({});
    expect(executeRule("@missing", ctx, "reactions")).toBeUndefined();
  });

  it("普通字符串字面量原样返回", () => {
    const ctx = makeCtx({});
    expect(executeRule("hello", ctx, "reactions")).toBe("hello");
  });

  it("数字 / 布尔 / 对象 / 数组字面量原样返回", () => {
    const ctx = makeCtx({});
    expect(executeRule(42, ctx, "reactions")).toBe(42);
    expect(executeRule(true, ctx, "reactions")).toBe(true);
    const obj = { a: 1 };
    expect(executeRule(obj, ctx, "reactions")).toBe(obj);
    const arr = [1, 2];
    expect(executeRule(arr, ctx, "reactions")).toBe(arr);
  });
});
