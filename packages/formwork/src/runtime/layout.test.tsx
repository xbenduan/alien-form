import { expect, it } from "vitest";
import { defineFormwork, definePage, defineWindow } from "./define";
import { createFormworkApi } from "../model/http";

const api = createFormworkApi({ url: "/unused" });
const list = definePage({ router: "list", container: () => null });
it("模型 Page 默认使用 modelId，普通 Page 使用自己的静态路径", () => {
  expect(list.path).toBe("/list/:modelId");
  expect(definePage({ router: "home", render: () => null }).path).toBeUndefined();
  expect(() => defineFormwork({ api, pages: [list], presenters: { page: (props) => props.children } })).toThrow("getSchema");
});
it("装配时拒绝绝对 Window 路径和未注册的默认 Presenter", () => {
  const base = { api, getSchema: () => ({ id: "orders", title: "订单", data: { type: "object" as const, properties: {} } }), presenters: { page: (props: { children?: any }) => props.children } };
  const window = defineWindow({ path: "/edit", container: () => null });
  expect(() => defineFormwork({ ...base, pages: [definePage({ ...list, windows: { edit: window } })] })).toThrow("相对路径");
  expect(() => defineFormwork({ ...base, pages: [definePage({ ...list, windows: { edit: defineWindow({ container: () => null, openMode: "modal" }) } })] })).toThrow("modal Presenter");
});
