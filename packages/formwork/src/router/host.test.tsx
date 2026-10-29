import { afterEach, describe, expect, it } from "vitest";
import { onCleanup } from "solid-js";
import type { Component } from "solid-js";
import { render } from "solid-js/web";
import { defineDomain, defineFormwork, definePage, defineWindow } from "../runtime/define";
import type { ActionContext, PageContext, PresenterProps } from "../runtime/types";
import type { ModelDocument, ModelSource } from "../model/types";

const model: ModelDocument = {
  id: "orders",
  title: "订单",
  data: { type: "object", properties: { name: { type: "string", default: "初始" } } },
};
let reads = 0;
const models: ModelSource = {
  list: async () => [],
  read: async () => {
    reads++;
    return {
      id: "orders",
      title: "订单",
      document: model,
      revision: "one",
      completeness: "full",
      writable: false,
      location: { kind: "local", path: "model.json" },
    };
  },
  write: async () => {
    throw new Error("READ_ONLY");
  },
};
const Page: Component<PresenterProps> = (props) => <section>{props.children}</section>;
const Modal: Component<PresenterProps> = (props) => (
  <aside role="dialog" data-direct={props.direct}>
    {props.children}
    <button onClick={props.close}>关闭</button>
  </aside>
);
const wait = async (condition: () => unknown) => expect.poll(condition).toBeTruthy();
let stop: (() => void) | undefined;
const original = location.pathname + location.search;
afterEach(() => {
  stop?.();
  stop = undefined;
  document.body.replaceChildren();
  history.replaceState({}, "", original);
});
const mount = (App: Component, path: string) => {
  history.replaceState({}, "", path);
  const element = document.createElement("div");
  document.body.append(element);
  stop = render(() => <App />, element);
  return element;
};
describe("常驻 Host 与完整 Window", () => {
  it("Page Window 完成恢复原调用者和值，first terminal 胜出", async () => {
    let caller!: ActionContext;
    let editor!: PageContext;
    let mounts = 0;
    let cleanups = 0;
    const app = defineFormwork({
      models,
      presenters: { page: Page },
      pages: [
        definePage({
          router: "home",
          render: (ctx) => {
            caller = ctx;
            mounts++;
            onCleanup(() => cleanups++);
            return <input aria-label="调用者" />;
          },
        }),
      ],
      windows: [
        defineWindow({
          router: "edit",
          path: "/edit/:domain",
          returnTo: "home",
          presentation: "page",
          container: (ctx) => {
            editor = ctx;
            return <p>编辑 {String((ctx.scope.value() as { name: string }).name)}</p>;
          },
        }),
      ],
    });
    const dom = mount(app.render, "/home");
    await wait(() => caller);
    const input = dom.querySelector("input")!;
    input.value = "保留";
    const promise = caller.open("edit", { domain: "orders" });
    await wait(() => editor);
    expect(input.closest("[hidden]")).toBeTruthy();
    editor.scope.set("/name", "已编辑");
    editor.complete("saved");
    editor.complete("twice");
    expect(await promise).toEqual({ status: "completed", value: "saved" });
    await wait(() => location.pathname === "/home");
    expect(dom.querySelector("input")).toBe(input);
    expect(input.value).toBe("保留");
    expect(mounts).toBe(1);
    expect(cleanups).toBe(0);
    expect(() => editor.scope.set("/name", "late")).toThrow(/销毁/);
  });
  it("直达使用固定 Modal，嵌套 Window 与普通导航均结算取消", async () => {
    let edit!: ActionContext;
    let detail!: ActionContext;
    const app = defineFormwork({
      models,
      presenters: { page: Page, modal: Modal, drawer: Modal },
      pages: [definePage({ router: "home", render: () => <p>首页</p> })],
      windows: [
        defineWindow({
          router: "edit",
          path: "/edit/:domain",
          presentation: "modal",
          returnTo: "home",
          render: (ctx) => {
            edit = ctx;
            return <p>普通 Window</p>;
          },
        }),
        defineWindow({
          router: "detail",
          path: "/detail/:domain",
          presentation: "drawer",
          returnTo: "home",
          render: (ctx) => {
            detail = ctx;
            return <p>子 Window</p>;
          },
        }),
      ],
    });
    reads = 0;
    const dom = mount(app.render, "/edit/orders");
    await wait(() => edit);
    expect(dom.querySelector('[role="dialog"]')?.getAttribute("data-direct")).toBe("true");
    expect(reads).toBe(0);
    const nested = edit.open("detail", { domain: "orders" });
    await wait(() => detail);
    detail.navigate("home");
    expect(await nested).toEqual({ status: "cancelled" });
    await wait(() => location.pathname === "/home");
    expect(edit.signal.aborted).toBe(true);
    expect(detail.signal.aborted).toBe(true);
  });
  it("浏览器 back 取消、forward 创建新 Instance，调用者仍存活", async () => {
    let caller!: ActionContext;
    let windowCtx!: ActionContext;
    let mounts = 0;
    const app = defineFormwork({
      models,
      presenters: { page: Page, modal: Modal },
      pages: [
        definePage({
          router: "home",
          render: (ctx) => {
            caller = ctx;
            return <p>首页</p>;
          },
        }),
      ],
      windows: [
        defineWindow({
          router: "add",
          path: "/add/:domain",
          presentation: "modal",
          returnTo: "home",
          render: (ctx) => {
            mounts++;
            windowCtx = ctx;
            return <p>新建</p>;
          },
        }),
      ],
    });
    mount(app.render, "/home");
    await wait(() => caller);
    const outcome = caller.open("add", { domain: "orders" });
    await wait(() => windowCtx);
    const previous = windowCtx;
    history.back();
    expect(await outcome).toEqual({ status: "cancelled" });
    await wait(() => location.pathname === "/home");
    expect(previous.signal.aborted).toBe(true);
    history.forward();
    await wait(() => mounts === 2);
    expect(windowCtx).not.toBe(previous);
    expect(caller.signal.aborted).toBe(false);
  });
  it("Domain 失败显示错误和重试，不静默回退；有效覆盖先于挂载", async () => {
    let attempts = 0;
    const domain = defineDomain({ container: (ctx) => <p>覆盖 {ctx.model.title}</p> });
    const app = defineFormwork({
      models,
      presenters: { page: Page },
      container: () => <p>默认容器</p>,
      pages: [
        definePage({ router: "home", render: () => null }),
        definePage({
          router: "list",
          path: "/list/:domain",
          domains: {
            orders: async () => {
              if (++attempts === 1) throw new Error("Domain 暂不可用");
              return { default: domain };
            },
          },
        }),
      ],
    });
    const dom = mount(app.render, "/list/orders");
    await wait(() => dom.textContent?.includes("Domain 暂不可用"));
    expect(dom.textContent).not.toContain("默认容器");
    dom.querySelector("button")!.click();
    await wait(() => dom.textContent?.includes("覆盖 订单"));
    expect(attempts).toBe(2);
  });
  it("同一 Window 双开值与 Promise 独立，提前完成一个不销毁另一个", async () => {
    let caller!: ActionContext;
    const windows: PageContext[] = [];
    const app = defineFormwork({
      models,
      presenters: { page: Page, modal: Modal },
      pages: [
        definePage({
          router: "home",
          render: (ctx) => {
            caller = ctx;
            return <p>首页</p>;
          },
        }),
      ],
      windows: [
        defineWindow({
          router: "edit",
          path: "/edit/:domain",
          presentation: "modal",
          returnTo: "home",
          container: (ctx) => {
            windows.push(ctx);
            return <p>{String((ctx.scope.value() as { name: string }).name)}</p>;
          },
        }),
      ],
    });
    mount(app.render, "/home");
    await wait(() => caller);
    const first = caller.open("edit", { domain: "orders" });
    await wait(() => windows.length === 1 && location.pathname === "/edit/orders");
    const second = caller.open("edit", { domain: "orders" });
    await wait(() => windows.length === 2);
    windows[0]!.scope.set("/name", "第一份");
    expect(windows[1]!.scope.value()).toEqual({ name: "初始" });
    windows[0]!.complete(1);
    expect(await first).toEqual({ status: "completed", value: 1 });
    expect(windows[1]!.signal.aborted).toBe(false);
    windows[1]!.complete(2);
    expect(await second).toEqual({ status: "completed", value: 2 });
    await wait(() => location.pathname === "/home");
    expect(caller.signal.aborted).toBe(false);
  });
  it("受管清理异常不阻止其余 scope 禁写或 Window Promise 结算", async () => {
    let caller!: ActionContext;
    let editor!: PageContext;
    const app = defineFormwork({
      models,
      presenters: { page: Page, modal: Modal },
      pages: [
        definePage({
          router: "home",
          render: (ctx) => {
            caller = ctx;
            return <p>首页</p>;
          },
        }),
      ],
      windows: [
        defineWindow({
          router: "edit",
          path: "/edit/:domain",
          presentation: "modal",
          returnTo: "home",
          container: (ctx) => {
            editor = ctx;
            const one = ctx.createScope();
            const two = ctx.createScope();
            onCleanup(() => {
              throw new Error("cleanup test");
            });
            return (
              <p>
                {JSON.stringify(one.value())}
                {JSON.stringify(two.value())}
                {JSON.stringify(ctx.scope.value())}
              </p>
            );
          },
        }),
      ],
    });
    mount(app.render, "/home");
    await wait(() => caller);
    const outcome = caller.open("edit", { domain: "orders" });
    await wait(() => editor);
    editor.navigate("home");
    expect(await outcome).toEqual({ status: "cancelled" });
    expect(editor.signal.aborted).toBe(true);
    expect(() => editor.scope.set("/name", "late")).toThrow(/销毁/);
    await wait(() => location.pathname === "/home");
  });
});
