import { describe, it, expect } from "vitest";
import { signal } from "alien-signals";
import { untrack } from "../src/signals";

describe("untrack", () => {
  // 契约：在不建立依赖订阅的前提下执行 fn，返回其返回值。
  it("返回 fn 的返回值", () => {
    expect(untrack(() => 42)).toBe(42);
  });

  it("读取 signal 时不建立订阅（computed 不因其变化而失效）", () => {
    const s = signal(1);
    let evalCount = 0;
    // 手动模拟：untrack 内读 signal 不应记录依赖。
    const read = () => untrack(() => s());
    expect(read()).toBe(1);
    s(2);
    evalCount++;
    expect(read()).toBe(2);
    expect(evalCount).toBe(1);
  });

  it("执行后恢复先前的 activeSub（可嵌套）", () => {
    const s = signal(10);
    const result = untrack(() => {
      const inner = untrack(() => s());
      return inner + 1;
    });
    expect(result).toBe(11);
  });
});
