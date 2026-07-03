import { describe, it, expect } from "vitest";
import { createContext, buildScope, resolveField } from "../src/runtime/context";
import type { FieldLike } from "../src/schema";

/** 构造一棵最小可寻址字段树：root.group.a / root.group.b。 */
function makeTree() {
  const a = { path: "group.a", value: () => 3, parent: undefined as any };
  const b = { path: "group.b", value: () => 7, parent: undefined as any };
  const group: any = {
    path: "group",
    value: () => ({ a: 3, b: 7 }),
    children: new Map<string, any>([
      ["a", a],
      ["b", b],
    ]),
    parent: undefined,
  };
  a.parent = group;
  b.parent = group;
  const root: any = {
    path: "",
    value: () => ({ group: { a: 3, b: 7 } }),
    children: new Map<string, any>([["group", group]]),
    parent: undefined,
  };
  group.parent = root;
  return { root, group, a, b };
}

describe("createContext.get - 选择器解析", () => {
  it("userScope 命中优先返回", () => {
    const { root, a } = makeTree();
    const ctx = createContext({
      root,
      self: a,
      userScope: { foo: 123 },
      handlers: {},
      onError: () => {},
    });
    expect(ctx.get("foo")).toBe(123);
  });

  it("绝对 path 从根解析并读取 value()", () => {
    const { root, a } = makeTree();
    const ctx = createContext({
      root,
      self: a,
      userScope: {},
      handlers: {},
      onError: () => {},
    });
    expect(ctx.get("group.a")).toBe(3);
    expect(ctx.get("group.b")).toBe(7);
  });

  it("相对 ./sibling 以 self 的容器为基准", () => {
    const { root, b } = makeTree();
    const ctx = createContext({
      root,
      self: b as FieldLike,
      userScope: {},
      handlers: {},
      onError: () => {},
    });
    expect(ctx.get("./a")).toBe(3);
  });

  it("解析不到返回 undefined，不抛错", () => {
    const { root, a } = makeTree();
    const ctx = createContext({
      root,
      self: a,
      userScope: {},
      handlers: {},
      onError: () => {},
    });
    expect(ctx.get("nope.deep")).toBeUndefined();
  });
});

describe("resolveField", () => {
  it("绝对 path 返回字段节点本身（而非其值）", () => {
    const { root, a, group } = makeTree();
    expect(resolveField(root, root, "group.a")).toBe(a);
    expect(resolveField(root, root, "group")).toBe(group);
  });

  it("path='' 返回 base 自身", () => {
    const { root } = makeTree();
    expect(resolveField(root, root, "")).toBe(root);
  });
});

describe("buildScope", () => {
  it("has 陷阱恒 true（拦截所有标识符）", () => {
    const { root, a } = makeTree();
    const ctx = createContext({
      root,
      self: a,
      userScope: {},
      handlers: {},
      onError: () => {},
    });
    const scope = buildScope(ctx) as any;
    expect("anythingAtAll" in scope).toBe(true);
  });

  it("内置 $value 返回当前字段值", () => {
    const { root, a } = makeTree();
    const ctx = createContext({
      root,
      self: a,
      userScope: {},
      handlers: {},
      onError: () => {},
    });
    const scope = buildScope(ctx) as any;
    expect(scope.$value).toBe(3);
  });

  it("valueOverride 覆盖 $value（format/validator 场景）", () => {
    const { root, a } = makeTree();
    const ctx = createContext({
      root,
      self: a,
      userScope: {},
      handlers: {},
      onError: () => {},
    });
    const scope = buildScope(ctx, 999) as any;
    expect(scope.$value).toBe(999);
  });

  it("裸字段名经 get 陷阱解析为字段值", () => {
    const { root, group } = makeTree();
    const ctx = createContext({
      root,
      self: group,
      userScope: {},
      handlers: {},
      onError: () => {},
    });
    const scope = buildScope(ctx) as any;
    // 从根解析 group（容器）→ value()
    expect(scope.group).toEqual({ a: 3, b: 7 });
  });

  it("Symbol.unscopables 返回 undefined", () => {
    const { root, a } = makeTree();
    const ctx = createContext({
      root,
      self: a,
      userScope: {},
      handlers: {},
      onError: () => {},
    });
    const scope = buildScope(ctx) as any;
    expect(scope[Symbol.unscopables]).toBeUndefined();
  });
});
