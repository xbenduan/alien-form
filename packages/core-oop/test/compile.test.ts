import { describe, it, expect } from "vitest";
import { compile } from "../src/runtime/compile";

describe("compile", () => {
  // 契约：把表达式体编译成以 scope 为作用域的取值函数；with($scope) 取标识符；相同 body 命中缓存。
  it("返回一个以 scope 为作用域求值的函数", () => {
    const fn = compile("a + b");
    expect(fn({ a: 1, b: 2 })).toBe(3);
  });

  it("从 scope 解析裸标识符", () => {
    const fn = compile("status === 'vip'");
    expect(fn({ status: "vip" })).toBe(true);
    expect(fn({ status: "no" })).toBe(false);
  });

  it("相同 body 命中缓存返回同一函数引用", () => {
    const a = compile("x * 2");
    const b = compile("x * 2");
    expect(a).toBe(b);
  });

  it("不同 body 返回不同函数", () => {
    expect(compile("x * 2")).not.toBe(compile("x * 3"));
  });
});
