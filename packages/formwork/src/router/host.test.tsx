import { afterEach, expect, it } from "vitest";
import { onCleanup } from "solid-js";
import { render } from "solid-js/web";
import { createFormworkApi } from "../model/http";
import type { ModelDocument } from "../model/types";
import { defineFormwork, definePage, defineWindow } from "../runtime/define";
import type { ActionContext, FormworkDefinition, PageContext, PresenterProps, WindowContext } from "../runtime/types";
import { createMemoryNavigation, FormworkHost } from "./host";

const api = createFormworkApi({ url: "/unused" });
const model: ModelDocument = { id: "orders", title: "订单", data: { type: "object", properties: { name: { type: "string", default: "初始" } } } };
const Page = (props: PresenterProps) => <section data-mode="page" data-direct={props.direct}>{props.children}{props.window && <button onClick={props.close}>返回</button>}</section>;
const Modal = (props: PresenterProps) => <aside role="dialog" data-mode="modal">{props.children}<button onClick={props.close}>关闭</button></aside>;
const Drawer = (props: PresenterProps) => <aside role="dialog" data-mode="drawer">{props.children}<button onClick={props.close}>关闭</button></aside>;
const presenters = { page: Page, modal: Modal, drawer: Drawer };
let stop: (() => void) | undefined;
const original = location.pathname + location.search;
afterEach(() => { stop?.(); stop = undefined; document.body.replaceChildren(); history.replaceState({}, "", original); });
const mount = (app: FormworkDefinition, path: string) => {
  const element = document.createElement("div"); document.body.append(element);
  const navigation = createMemoryNavigation(path);
  stop = render(() => <FormworkHost app={app} navigation={navigation} />, element);
  return { element, navigation };
};

for (const mode of ["page", "modal", "drawer"] as const) it(`schema 配置 ${mode} 覆盖 Window 默认方式，完成恢复 Page 状态且仅结算一次`, async () => {
  let caller!: PageContext;
  let editor!: WindowContext;
  let mounts = 0;
  const app: FormworkDefinition = {
    api, presenters,
    getSchema: () => ({ ...model, pages: { list: { windows: { edit: { openMode: mode } } } } }),
    pages: [definePage({
      router: "list", container: (ctx) => { caller = ctx; mounts++; return <input aria-label="筛选" />; },
      windows: { edit: defineWindow({ openMode: "modal", path: "edit/:id", container: (ctx) => { editor = ctx; return <p>编辑</p>; } }) },
    })],
  };
  const { element, navigation } = mount(app, "/list/orders");
  await expect.poll(() => caller).toBeTruthy();
  const input = element.querySelector("input")!; input.value = "保留";
  const outcome = caller.open("edit", { params: { id: "a1" } });
  await expect.poll(() => editor).toBeTruthy();
  expect(element.querySelector('[data-formwork-window="edit"]')?.querySelector(`[data-mode="${mode}"]`)).toBeTruthy();
  expect(!!input.closest("[hidden]")).toBe(mode === "page");
  editor.scope.set("/name", "独立编辑");
  editor.complete("saved"); editor.complete("twice");
  expect(await outcome).toEqual({ status: "completed", value: "saved" });
  await expect.poll(() => navigation.location().pathname).toBe("/list/orders");
  expect(element.querySelector("input")).toBe(input); expect(input.value).toBe("保留"); expect(mounts).toBe(1);
  expect(() => editor.scope.set("/name", "迟到修改")).toThrow(/销毁/u);
});

it("直达和刷新 Window 使用 Page Presenter，加载 URL 记录，关闭返回所属 Page", async () => {
  let editor!: WindowContext;
  let pageMounts = 0;
  const app: FormworkDefinition = {
    api, presenters, getSchema: () => model,
    pages: [definePage({
      router: "list", container: () => { pageMounts++; return <p>列表</p>; },
      windows: { detail: defineWindow({
        path: "detail/:id", openMode: "drawer", readOnly: true,
        getValue: (ctx) => { expect(ctx.initialValue).toBeUndefined(); expect(ctx.params.id).toBe("a1"); return { name: "完整记录" }; },
        container: (ctx) => { editor = ctx; return <p>{JSON.stringify(ctx.scope.value())}</p>; },
      }) },
    })],
  };
  const { element, navigation } = mount(app, "/list/orders/detail/a1");
  await expect.poll(() => editor).toBeTruthy();
  expect(element.querySelector('[data-mode="page"][data-direct="true"]')).toBeTruthy();
  expect(element.querySelector('[role="dialog"]')).toBeNull(); expect(pageMounts).toBe(0);
  expect(() => editor.scope.set("/name", "修改")).toThrow(/只读/u);
  element.querySelector("button")!.click();
  await expect.poll(() => navigation.location().pathname).toBe("/list/orders");
  await expect.poll(() => element.textContent).toBe("列表");
});

it("同名 Window 在两个 Page 本地解析，参数继承不可改写，取消返回各自 Page", async () => {
  let page!: PageContext;
  let child!: WindowContext;
  const app: FormworkDefinition = {
    api, presenters, getSchema: () => model,
    pages: ["list", "tree-list"].map((router) => definePage({
      router, container: (ctx) => { page = ctx; return <p>{router}</p>; },
      windows: { detail: defineWindow({ path: "detail/:id", openMode: "drawer", container: (ctx) => { child = ctx; return <p>{ctx.router}:{ctx.window}</p>; } }) },
    })),
  };
  const { element, navigation } = mount(app, "/tree-list/orders");
  await expect.poll(() => page).toBeTruthy();
  await expect(page.open("missing")).rejects.toMatchObject({ code: "UNKNOWN_WINDOW" });
  await expect(page.open("detail", { params: { modelId: "cms", id: "a1" } })).rejects.toMatchObject({ code: "INVALID_PARAMS" });
  const outcome = page.open("detail", { params: { id: "a1" } });
  await expect.poll(() => child).toBeTruthy();
  expect(navigation.location().pathname).toBe("/tree-list/orders/detail/a1");
  expect(child.router).toBe("tree-list"); expect(child.window).toBe("detail");
  element.querySelector('[role="dialog"] button')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(await outcome).toEqual({ status: "cancelled" });
  expect(navigation.location().pathname).toBe("/tree-list/orders");
});

it("浏览器 back 取消，forward 在仍存活的调用者下重建 Instance", async () => {
  let caller!: ActionContext;
  let child!: ActionContext;
  let mounts = 0;
  const definition: FormworkDefinition = {
    api, presenters, pages: [definePage({ router: "home", render: (ctx) => { caller = ctx; return <p>首页</p>; },
      windows: { add: defineWindow({ openMode: "modal", render: (ctx) => { mounts++; child = ctx; return <p>新建</p>; } }) },
    })],
  };
  const app = defineFormwork(definition);
  const element = document.createElement("div"); document.body.append(element);
  history.replaceState({}, "", "/home"); stop = render(() => <app.render />, element);
  await expect.poll(() => caller).toBeTruthy();
  const outcome = caller.open("add");
  await expect.poll(() => child).toBeTruthy();
  const previous = child;
  history.back();
  expect(await outcome).toEqual({ status: "cancelled" });
  await expect.poll(() => location.pathname).toBe("/home");
  expect(previous.signal.aborted).toBe(true);
  history.forward();
  await expect.poll(() => mounts).toBe(2);
  expect(child).not.toBe(previous); expect(caller.signal.aborted).toBe(false);
  expect(element.querySelector('[role="dialog"]')).toBeTruthy();
});

it("加载期间后退只返回一次取消，迟到值不挂载，嵌套导航取消全部调用", async () => {
  let page!: PageContext;
  let loading!: ActionContext;
  let finish!: (value: { name: string }) => void;
  let child!: WindowContext;
  let mounts = 0;
  const app: FormworkDefinition = {
    api, presenters, getSchema: () => model,
    pages: [definePage({ router: "home", render: () => <p>首页</p> }), definePage({
      router: "list", container: (ctx) => { page = ctx; return <p>列表</p>; },
      windows: {
        edit: defineWindow({ openMode: "modal", getValue: (ctx) => { loading = ctx; return new Promise((done) => { finish = done; }); }, container: () => { mounts++; return <p>迟到</p>; } }),
        detail: defineWindow({ openMode: "drawer", container: (ctx) => { child = ctx; return <p>详情</p>; } }),
      },
    })],
  };
  const { navigation, element } = mount(app, "/list/orders");
  await expect.poll(() => page).toBeTruthy();
  let settlements = 0;
  const result = page.open("edit").then((outcome) => { settlements++; return outcome; });
  await expect.poll(() => loading).toBeTruthy();
  navigation.navigate(-1);
  expect(await result).toEqual({ status: "cancelled" });
  finish({ name: "迟到" }); await Promise.resolve(); await Promise.resolve();
  expect(loading.signal.aborted).toBe(true); expect(mounts).toBe(0); expect(settlements).toBe(1);
  const one = page.open("detail");
  await expect.poll(() => child).toBeTruthy();
  const first = child;
  const two = child.open("detail");
  await expect.poll(() => child !== first).toBe(true);
  child.navigate("home");
  expect(await one).toEqual({ status: "cancelled" }); expect(await two).toEqual({ status: "cancelled" });
  await expect.poll(() => element.textContent).toBe("首页");
});

it("同一 Window 双开值和 Promise 独立，完成较早调用保留另一调用", async () => {
  let page!: PageContext;
  const windows: WindowContext[] = [];
  const app: FormworkDefinition = {
    api, presenters, getSchema: () => model,
    pages: [definePage({
      router: "list", container: (ctx) => { page = ctx; return <p>列表</p>; },
      windows: { edit: defineWindow({ openMode: "modal", container: (ctx) => { windows.push(ctx); return <p>{JSON.stringify(ctx.scope.value())}</p>; } }) },
    })],
  };
  const { navigation } = mount(app, "/list/orders");
  await expect.poll(() => page).toBeTruthy();
  const one = page.open("edit", { initialValue: { name: "第一份" } });
  await expect.poll(() => windows.length).toBe(1);
  const two = page.open("edit");
  await expect.poll(() => windows.length).toBe(2);
  windows[0]!.scope.set("/name", "改动"); expect(windows[1]!.scope.value()).toEqual({ name: "初始" });
  windows[0]!.complete(1); expect(await one).toEqual({ status: "completed", value: 1 });
  expect(windows[1]!.signal.aborted).toBe(false);
  windows[1]!.complete(2); expect(await two).toEqual({ status: "completed", value: 2 });
  expect(navigation.location().pathname).toBe("/list/orders");
});

it("清理异常仍 abort 其他 scope 并结算 Window", async () => {
  let page!: PageContext; let child!: WindowContext;
  const app: FormworkDefinition = {
    api, presenters, getSchema: () => model,
    pages: [definePage({ router: "list", container: (ctx) => { page = ctx; return null; }, windows: {
      edit: defineWindow({ container: (ctx) => { child = ctx; ctx.createScope(); onCleanup(() => { throw new Error("cleanup test"); }); return <p>{JSON.stringify(ctx.scope.value())}</p>; } }),
    } })],
  };
  const { navigation } = mount(app, "/list/orders");
  await expect.poll(() => page).toBeTruthy();
  const result = page.open("edit"); await expect.poll(() => child).toBeTruthy();
  navigation.navigate(-1);
  expect(await result).toEqual({ status: "cancelled" }); expect(child.signal.aborted).toBe(true);
  expect(() => child.scope.set("/name", "迟到")).toThrow(/销毁/u);
});
