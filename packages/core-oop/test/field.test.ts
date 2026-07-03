import { describe, it, expect } from "vitest";
import {
  PrimitiveField,
  ObjectField,
  VoidField,
  ArrayField,
  Row,
  composeChildren,
} from "../src/field/field";
import type { IFieldSchema } from "../src/schema";

describe("Field 基础状态初始化", () => {
  // 契约：构造时依据 schema 初始化 title/display/disabled/options/component/decorator。
  it("从 schema 读取 title/display/disabled", () => {
    const f = new PrimitiveField("k", {
      type: "string",
      title: "标题",
      display: "hidden",
      disabled: true,
    });
    expect(f.title()).toBe("标题");
    expect(f.display()).toBe("hidden");
    expect(f.disabled()).toBe(true);
  });

  it("component 字符串 → 存 key，无 props", () => {
    const f = new PrimitiveField("k", { type: "string", component: "Input" });
    expect(f.component()).toBe("Input");
    expect(f.componentProps()).toEqual({});
  });

  it("component 元组 → 存 key 与 props", () => {
    const f = new PrimitiveField("k", {
      type: "string",
      component: ["Input", { placeholder: "x" }],
    });
    expect(f.component()).toBe("Input");
    expect(f.componentProps()).toEqual({ placeholder: "x" });
  });

  it("options 从 schema 初始化", () => {
    const opts = [{ label: "a", value: 1 }];
    const f = new PrimitiveField("k", { type: "string", options: opts });
    expect(f.options()).toEqual(opts);
  });

  it("每个字段有稳定唯一 id", () => {
    const a = new PrimitiveField("a", { type: "string" });
    const b = new PrimitiveField("b", { type: "string" });
    expect(a.id).not.toBe(b.id);
    expect(a.id).toBe(a.id);
  });
});

describe("PrimitiveField.setValue / reset", () => {
  it("setValue 写入内部值", () => {
    const f = new PrimitiveField("k", { type: "number" });
    f.setValue(5);
    expect(f.value()).toBe(5);
  });

  it("reset 回落 schema.default 并清空 errors", () => {
    const f = new PrimitiveField("k", { type: "number", default: 7 });
    f.setValue(99);
    f.errors([{ path: "k", message: "x" }]);
    f.reset();
    expect(f.value()).toBe(7);
    expect(f.errors()).toEqual([]);
  });
});

describe("path 惰性派生", () => {
  it("根字段 path 为空", () => {
    const root = new ObjectField("", { type: "object" });
    expect(root.path).toBe("");
  });

  it("子字段 path = 父 path + key", () => {
    const root = new ObjectField("", { type: "object" });
    const child = new PrimitiveField("name", { type: "string" }, root);
    expect(child.path).toBe("name");
  });

  it("行内字段 path 使用 row.index", () => {
    const root = new ObjectField("", { type: "object" });
    const arr = new ArrayField("list", { type: "array" }, root);
    const row = new Row(arr);
    row.index(2);
    const child = new PrimitiveField("x", { type: "string" }, arr, row);
    expect(child.path).toBe("list.2");
  });
});

describe("composeChildren", () => {
  // 契约：按 order 排序，跳过 display:none，void 摊平提升到本层。
  it("按 order 排序组合", () => {
    const c: any = { children: new Map() };
    c.children.set("b", new PrimitiveField("b", { type: "number", order: 2 }));
    c.children.set("a", new PrimitiveField("a", { type: "number", order: 1 }));
    (c.children.get("a") as PrimitiveField).setValue(1);
    (c.children.get("b") as PrimitiveField).setValue(2);
    expect(Object.keys(composeChildren(c))).toEqual(["a", "b"]);
  });

  it("跳过 display:none 字段", () => {
    const c: any = { children: new Map() };
    const hidden = new PrimitiveField("h", { type: "number" });
    hidden.display("none");
    hidden.setValue(1);
    const shown = new PrimitiveField("s", { type: "number" });
    shown.setValue(2);
    c.children.set("h", hidden);
    c.children.set("s", shown);
    expect(composeChildren(c)).toEqual({ s: 2 });
  });

  it("void 字段摊平提升其孩子到本层", () => {
    const c: any = { children: new Map() };
    const v = new VoidField("wrap", { type: "void" });
    const inner = new PrimitiveField("inner", { type: "number" });
    inner.setValue(9);
    v.children.set("inner", inner);
    c.children.set("wrap", v);
    expect(composeChildren(c)).toEqual({ inner: 9 });
  });
});

describe("ObjectField.value / VoidField.value", () => {
  it("object value 组合孩子内部值", () => {
    const o = new ObjectField("o", { type: "object" });
    const a = new PrimitiveField("a", { type: "number" });
    a.setValue(1);
    o.children.set("a", a);
    expect(o.value()).toEqual({ a: 1 });
  });
});

describe("ArrayField 行操作", () => {
  function makeArray() {
    const arr = new ArrayField("list", { type: "array" });
    arr.buildRow = (row, init) => {
      const child = new PrimitiveField("v", { type: "number" }, arr, row);
      child.setValue(init?.v);
      row.children.set("v", child);
    };
    return arr;
  }

  it("setRows 按值数组重建行", () => {
    const arr = makeArray();
    arr.setRows([{ v: 1 }, { v: 2 }]);
    expect(arr.value()).toEqual([{ v: 1 }, { v: 2 }]);
  });

  it("push 追加一行并返回新行", () => {
    const arr = makeArray();
    arr.setRows([{ v: 1 }]);
    const row = arr.push({ v: 2 });
    expect(row).toBeInstanceOf(Row);
    expect(arr.value()).toEqual([{ v: 1 }, { v: 2 }]);
  });

  it("remove 删除行，其余行 index 下移", () => {
    const arr = makeArray();
    arr.setRows([{ v: 1 }, { v: 2 }, { v: 3 }]);
    arr.remove(0);
    expect(arr.value()).toEqual([{ v: 2 }, { v: 3 }]);
    expect(arr.rows()[0].index()).toBe(0);
    expect(arr.rows()[1].index()).toBe(1);
  });

  it("move 移动行并重排 index", () => {
    const arr = makeArray();
    arr.setRows([{ v: 1 }, { v: 2 }, { v: 3 }]);
    arr.move(0, 2);
    expect(arr.value()).toEqual([{ v: 2 }, { v: 3 }, { v: 1 }]);
  });

  it("reset 回落到 schema.default 数组", () => {
    const arr = new ArrayField("list", {
      type: "array",
      default: [{ v: 5 }],
    } as IFieldSchema);
    arr.buildRow = (row, init) => {
      const child = new PrimitiveField("v", { type: "number" }, arr, row);
      child.setValue(init?.v);
      row.children.set("v", child);
    };
    arr.setRows([{ v: 1 }, { v: 2 }]);
    arr.reset();
    expect(arr.value()).toEqual([{ v: 5 }]);
  });
});
