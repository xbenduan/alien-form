import { createRoot } from "solid-js";
import { describe, expect, it } from "vitest";
import type { DataSchema } from "../model/types";
import { createValueScope } from "./scope";

const schema: DataSchema = {
  type: "object",
  properties: {
    name: { type: "string", default: "初始" },
    paid: { type: "boolean", default: true },
    count: { type: "integer", default: 8 },
    locked: { type: "string", readOnly: true },
    detail: { type: "object", properties: { note: { type: "string" } } },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: { sku: { type: "string", minLength: 2 } },
        required: ["sku"],
      },
    },
    tags: { type: "array", items: { type: "string" } },
  },
};
describe("ValueScope 的公开值与生命周期", () => {
  it("补缺失 default、保留显式值、深写、删除、普通快照和 reset", () =>
    createRoot((dispose) => {
      const scope = createValueScope({ value: { paid: false, count: 0 } }, schema);
      expect(scope.value()).toEqual({ name: "初始", paid: false, count: 0 });
      scope.set("/detail/note", "新值");
      const snapshot = scope.value() as { detail: { note: string } };
      snapshot.detail.note = "外部修改";
      expect(scope.value()).toMatchObject({ detail: { note: "新值" } });
      scope.set("/name", undefined);
      expect(scope.value()).not.toHaveProperty("name");
      scope.reset({ name: "" });
      expect(scope.value()).toEqual({ name: "" });
      scope.reset();
      expect(scope.value()).toEqual({ name: "初始", paid: false, count: 0 });
      expect(() => scope.set("/locked", "bad")).toThrow(/只读/);
      expect(() => scope.set("/missing", 1)).toThrow(/不存在/);
      dispose();
      expect(() => scope.set("/name", "late")).toThrow(/销毁/);
    }));
  it("move 保持 item scope、错误身份，remove/reset 销毁旧项", async () => {
    let dispose!: () => void;
    const scope = createRoot((stop) => {
      dispose = stop;
      return createValueScope({ value: { lines: [{ sku: "a" }, { sku: "good" }] } }, schema);
    });
    const array = scope.array("/lines");
    const item = array.items()[0]!;
    expect((await item.scope.validate()).status).toBe("invalid");
    array.move(item.key, 1);
    expect(array.items()[1]).toBe(item);
    expect(scope.errors()).toMatchObject([{ path: "/lines/1/sku", code: "MIN_LENGTH" }]);
    item.scope.set("/sku", "changed");
    expect(scope.value()).toMatchObject({ lines: [{ sku: "good" }, { sku: "changed" }] });
    array.remove(item.key);
    expect(() => item.scope.set("/sku", "late")).toThrow(/销毁/);
    const old = array.items()[0]!;
    scope.reset({ lines: [{ sku: "new" }] });
    expect(array.items()[0]!.key).not.toBe(old.key);
    expect(() => old.scope.set("/sku", "late")).toThrow(/销毁/);
    dispose();
  });
  it("过期异步校验被新值、轮次和销毁淘汰", async () => {
    let resolve!: (value: readonly { path: string; code: string; message: string }[]) => void;
    let signal!: AbortSignal;
    let dispose!: () => void;
    const scope = createRoot((stop) => {
      dispose = stop;
      return createValueScope(
        {
          validate: (_value, context) => {
            signal = context.signal;
            return new Promise((done) => {
              resolve = done;
            });
          },
        },
        schema,
      );
    });
    const task = scope.validate();
    scope.set("/name", "new");
    expect(signal.aborted).toBe(true);
    resolve([{ path: "/name", code: "LATE", message: "旧错误" }]);
    expect((await task).status).toBe("stale");
    expect(scope.errors()).toEqual([]);
    const last = scope.validate();
    dispose();
    resolve([]);
    expect((await last).status).toBe("stale");
  });
  it("数组标量不写 undefined，readOnly 由写入口执行", () =>
    createRoot((dispose) => {
      const scope = createValueScope({}, schema);
      const tags = scope.array("/tags");
      expect(() => tags.insert(0)).toThrow(/需要明确/);
      tags.insert(0, "");
      expect(() => scope.set("/tags/0", undefined)).toThrow(/不能删除/);
      expect(() => tags.move(tags.items()[0]!.key, 2)).toThrow(/越界/);
      const readonly = createValueScope({ readOnly: true, value: { tags: ["x"] } }, schema);
      expect(() => readonly.array("/tags").remove(readonly.array("/tags").items()[0]!.key)).toThrow(
        /只读/,
      );
      dispose();
    }));
});
