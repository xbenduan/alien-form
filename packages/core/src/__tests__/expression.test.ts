import { describe, expect, it } from "vitest";
import { evaluateExpression } from "../schema/expression";

describe("expression evaluator", () => {
  it("evaluates numeric literals", () => {
    expect(evaluateExpression("42", {})).toBe(42);
    expect(evaluateExpression("3.14", {})).toBe(3.14);
    expect(evaluateExpression(".5", {})).toBe(0.5);
  });

  it("evaluates string literals", () => {
    expect(evaluateExpression("'hello'", {})).toBe("hello");
    expect(evaluateExpression('"world"', {})).toBe("world");
    expect(evaluateExpression("'it\\'s'", {})).toBe("it's");
  });

  it("evaluates boolean and null literals", () => {
    expect(evaluateExpression("true", {})).toBe(true);
    expect(evaluateExpression("false", {})).toBe(false);
    expect(evaluateExpression("null", {})).toBe(null);
    expect(evaluateExpression("undefined", {})).toBe(undefined);
  });

  it("evaluates identifiers from scope", () => {
    expect(evaluateExpression("x", { x: 10 })).toBe(10);
    expect(evaluateExpression("missing", {})).toBe(undefined);
  });

  it("evaluates arithmetic operations", () => {
    expect(evaluateExpression("2 + 3", {})).toBe(5);
    expect(evaluateExpression("10 - 3", {})).toBe(7);
    expect(evaluateExpression("4 * 5", {})).toBe(20);
    expect(evaluateExpression("10 / 2", {})).toBe(5);
    expect(evaluateExpression("10 % 3", {})).toBe(1);
  });

  it("evaluates comparison operators", () => {
    expect(evaluateExpression("1 < 2", {})).toBe(true);
    expect(evaluateExpression("2 <= 2", {})).toBe(true);
    expect(evaluateExpression("3 > 2", {})).toBe(true);
    expect(evaluateExpression("2 >= 3", {})).toBe(false);
    expect(evaluateExpression("1 === 1", {})).toBe(true);
    expect(evaluateExpression("1 !== 2", {})).toBe(true);
    expect(evaluateExpression("1 == '1'", {})).toBe(true);
    expect(evaluateExpression("1 != '2'", {})).toBe(true);
  });

  it("evaluates logical operators", () => {
    expect(evaluateExpression("true && false", {})).toBe(false);
    expect(evaluateExpression("true || false", {})).toBe(true);
    expect(evaluateExpression("null ?? 'fallback'", {})).toBe("fallback");
    expect(evaluateExpression("0 ?? 'fallback'", {})).toBe(0);
  });

  it("evaluates unary operators", () => {
    expect(evaluateExpression("!true", {})).toBe(false);
    expect(evaluateExpression("-5", {})).toBe(-5);
    expect(evaluateExpression("+5", {})).toBe(5);
    expect(evaluateExpression("!'hello'", {})).toBe(false);
  });

  it("evaluates ternary conditional", () => {
    expect(evaluateExpression("true ? 'yes' : 'no'", {})).toBe("yes");
    expect(evaluateExpression("false ? 'yes' : 'no'", {})).toBe("no");
    expect(evaluateExpression("x > 5 ? 'big' : 'small'", { x: 10 })).toBe("big");
  });

  it("evaluates member access (dot notation)", () => {
    expect(evaluateExpression("obj.name", { obj: { name: "test" } })).toBe("test");
    expect(evaluateExpression("obj.nested.value", { obj: { nested: { value: 42 } } })).toBe(42);
  });

  it("evaluates member access (bracket notation)", () => {
    expect(evaluateExpression("obj['name']", { obj: { name: "test" } })).toBe("test");
    expect(evaluateExpression("arr[0]", { arr: ["first", "second"] })).toBe("first");
  });

  it("evaluates array literals", () => {
    expect(evaluateExpression("[1, 2, 3]", {})).toEqual([1, 2, 3]);
    expect(evaluateExpression("['a', 'b']", {})).toEqual(["a", "b"]);
    expect(evaluateExpression("[]", {})).toEqual([]);
  });

  it("evaluates object literals", () => {
    expect(evaluateExpression("{ a: 1, b: 2 }", {})).toEqual({ a: 1, b: 2 });
    expect(evaluateExpression("{ name: x }", { x: "test" })).toEqual({ name: "test" });
  });

  it("handles nested expressions", () => {
    expect(evaluateExpression("(1 + 2) * 3", {})).toBe(9);
    expect(evaluateExpression("a ? b + 1 : c * 2", { a: true, b: 5, c: 3 })).toBe(6);
  });

  it("safely returns undefined for null member access", () => {
    expect(evaluateExpression("obj.missing", { obj: {} })).toBe(undefined);
    expect(evaluateExpression("nothing.value", {})).toBe(undefined);
  });

  it("rejects forbidden identifiers", () => {
    expect(() => evaluateExpression("globalThis", {})).toThrow();
    expect(() => evaluateExpression("window", {})).toThrow();
    expect(() => evaluateExpression("eval", {})).toThrow();
    expect(() => evaluateExpression("Function", {})).toThrow();
  });

  it("rejects function calls", () => {
    expect(() => evaluateExpression("Number(x)", { x: "5" })).toThrow(/function calls/);
    expect(() => evaluateExpression("x.trim()", { x: " hi " })).toThrow(/function calls/);
  });

  it("rejects assignments", () => {
    expect(() => evaluateExpression("x = 1", { x: 0 })).toThrow(/assignment/);
  });

  it("rejects arrow functions and template literals", () => {
    expect(() => evaluateExpression("() => 1", {})).toThrow();
    expect(() => evaluateExpression("`hello`", {})).toThrow();
  });

  it("rejects prototype access", () => {
    expect(() => evaluateExpression("obj.__proto__", { obj: {} })).toThrow();
    expect(() => evaluateExpression("obj.constructor", { obj: {} })).toThrow();
  });

  it("handles empty string", () => {
    expect(() => evaluateExpression("", {})).toThrow();
  });

  it("handles complex real-world expressions", () => {
    const scope = { $deps: { type: "company" }, $value: "hello" };
    expect(evaluateExpression("$deps.type === 'company' ? 'Company' : 'Person'", scope)).toBe("Company");
    expect(evaluateExpression("($value || '') + ' world'", scope)).toBe("hello world");
  });
});
