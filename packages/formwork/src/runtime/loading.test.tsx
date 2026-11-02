import { afterEach, expect, it } from "vitest";
import { render } from "solid-js/web";
import { modelDocumentSchema } from "../model/schema";
import { createFormworkApi } from "../model/http";
import type { ModelDocument } from "../model/types";
import { createMemoryNavigation, FormworkHost } from "../router/host";
import { defineDomain, definePage, defineWindow } from "./define";
import type { FormworkDefinition, PageContext, SchemaLoadContext, WindowContext } from "./types";

const stored: ModelDocument = {
  id: "orders", title: "数据库标题",
  data: { type: "object", properties: { name: { type: "string", default: "原值" } } },
};
const api = createFormworkApi({ url: "/unused" });
const presenter = (props: { children?: any }) => props.children;
let dispose: (() => void) | undefined;
afterEach(() => { dispose?.(); document.body.replaceChildren(); });
const mount = (app: FormworkDefinition, path = "/list/orders") => {
  const host = document.createElement("div");
  document.body.append(host);
  const navigation = createMemoryNavigation(path);
  dispose = render(() => <FormworkHost app={app} navigation={navigation} />, host);
  return { host, navigation };
};

it("读取后选择 Domain，先 modelSchema 再 transformSchema，并保留代码 props", async () => {
  const order: string[] = [];
  let calls = 0;
  const app: FormworkDefinition = {
    api,
    getSchema: (ctx) => {
      expect(ctx.modelId).toBe("orders");
      expect("fn" in ctx).toBe(false);
      order.push("loader"); return stored;
    },
    domains: { orders: defineDomain({
      modelSchema: modelDocumentSchema.refine(() => { order.push("validator"); return true; }),
      transformSchema: (ctx) => {
        order.push("transform");
        expect(ctx.domain).toBe("orders");
        expect(ctx.window).toBeUndefined();
        ctx.schema.title = "定制标题";
        return { ...ctx.schema, views: { list: { component: "Button", props: { onClick: () => calls++ } } } };
      },
      components: { Button: (props) => <button onClick={props.onClick}>代码事件</button> },
    }) },
    pages: [definePage({ router: "list", container: (ctx) => <><h1>{ctx.schema.title}</h1>{ctx.children}</> })],
    presenters: { page: presenter },
  };
  const { host } = mount(app);
  await expect.poll(() => host.querySelector("button")).toBeTruthy();
  expect(order).toEqual(["loader", "validator", "transform"]);
  expect(stored.title).toBe("数据库标题");
  expect(host.textContent).toContain("定制标题");
  expect(calls).toBe(0); host.querySelector("button")!.click(); expect(calls).toBe(1);
});

it("多个模型共享显式 Domain，modelId 保持各自数据身份，省略时按 id 查找或回退", async () => {
  let ctx!: PageContext;
  const app: FormworkDefinition = {
    api, getSchema: ({ modelId }) => ({ ...stored, id: modelId, ...(modelId !== "orders" ? { domain: "cms" } : {}) }),
    domains: { cms: defineDomain({ fn: { identify: (ctx) => `${ctx.modelId}:${ctx.domain}` } }) },
    fn: { identify: (ctx) => `${ctx.modelId}:framework` },
    pages: [definePage({ router: "list", container: (value) => { ctx = value; return <p>{ctx.fn.identify()}</p>; } })],
    presenters: { page: presenter },
  };
  const { host, navigation } = mount(app, "/list/articles");
  await expect.poll(() => host.textContent).toBe("articles:cms");
  navigation.navigate("/list/announcements");
  await expect.poll(() => host.textContent).toBe("announcements:cms");
  navigation.navigate("/list/orders");
  await expect.poll(() => host.textContent).toBe("orders:framework");
  expect(ctx.domain).toBeUndefined();
});

it("显式未知 Domain 不回退；选中 Domain 的导入失败可以重试", async () => {
  let selected = "missing";
  let attempts = 0;
  const app: FormworkDefinition = {
    api, getSchema: () => ({ ...stored, domain: selected }),
    domains: { cms: async () => {
      if (++attempts === 1) throw new Error("Domain 暂不可用");
      return { default: defineDomain({ transformSchema: (ctx) => ({ ...ctx.schema, title: "已恢复" }) }) };
    } },
    pages: [definePage({ router: "list", container: (ctx) => <p>{ctx.schema.title}</p> })],
    presenters: { page: presenter },
  };
  const { host } = mount(app);
  await expect.poll(() => host.textContent).toContain("UNKNOWN_DOMAIN");
  expect(attempts).toBe(0);
  selected = "cms"; host.querySelector("button")!.click();
  await expect.poll(() => host.textContent).toContain("Domain 暂不可用");
  host.querySelector("button")!.click();
  await expect.poll(() => host.textContent).toBe("已恢复");
  expect(attempts).toBe(2);
});

it("Window 复用 schema 快照并重新绑定四层 fn，getValue 读取完整值且不补默认", async () => {
  let page!: PageContext;
  let window!: WindowContext;
  let reads = 0;
  let transforms = 0;
  const identify = (layer: string) => (ctx: PageContext | any) => `${layer}:${ctx.modelId}:${ctx.router}:${ctx.window ?? ""}:${ctx.params.id ?? ""}`;
  const app: FormworkDefinition = {
    api, getSchema: () => { reads++; return stored; },
    fn: { identify: identify("framework") },
    domains: { orders: defineDomain({ fn: { identify: identify("domain") }, transformSchema: (ctx) => { transforms++; return ctx.schema; } }) },
    pages: [definePage({
      router: "list", fn: { identify: identify("page") },
      container: (ctx) => { page = ctx; return <p>{ctx.fn.identify()}</p>; },
      windows: { edit: defineWindow({
        path: "edit/:id", openMode: "modal", fn: { identify: identify("window") },
        getValue: (ctx) => {
          expect(ctx.fn.identify()).toBe("window:orders:list:edit:a1");
          expect(ctx.initialValue).toEqual({ name: "列表投影" });
          return {};
        },
        container: (ctx) => { window = ctx; return <p>编辑</p>; },
      }) },
    })],
    presenters: { page: presenter, modal: presenter },
  };
  const { host } = mount(app);
  await expect.poll(() => page).toBeTruthy();
  const input = { name: "列表投影" };
  const outcome = page.open("edit", { params: { id: "a1" }, initialValue: input });
  input.name = "后来修改";
  await expect.poll(() => window).toBeTruthy();
  expect(window.scope.value()).toEqual({});
  expect(window.schema).toBe(page.schema);
  expect(reads).toBe(1); expect(transforms).toBe(1);
  window.complete("saved");
  expect(await outcome).toEqual({ status: "completed", value: "saved" });
  expect(host.textContent).toBe("page:orders:list::");
});

it("直达 Window 的局部组件覆盖参与校验，无需先挂载 Page", async () => {
  const app: FormworkDefinition = {
    api, getSchema: () => ({ ...stored, fields: { "/name": { form: { component: "OnlyWindow" } } }, views: { "list/edit": { field: "/name" } } }),
    pages: [definePage({ router: "list", container: () => { throw new Error("不应挂载"); }, windows: {
      edit: defineWindow({ path: "edit/:id", components: { OnlyWindow: (props) => <b>{props.value}</b> }, container: (ctx) => ctx.children }),
    } })],
    presenters: { page: presenter },
  };
  const { host } = mount(app, "/list/orders/edit/a1");
  await expect.poll(() => host.textContent).toBe("原值");
});

it("离开加载页先 abort，迟到 schema 不执行 Domain 或挂载内容", async () => {
  let finish!: (value: ModelDocument) => void;
  let ctx!: SchemaLoadContext;
  let transforms = 0;
  const app: FormworkDefinition = {
    api,
    domains: { orders: defineDomain({ transformSchema: (ctx) => { transforms++; return ctx.schema; } }) },
    pages: [definePage({ router: "home", render: () => <p>首页</p> }), definePage({
      router: "list", getSchema: (value) => { ctx = value; return new Promise<ModelDocument>((done) => { finish = done; }); },
      container: () => <p>迟到内容</p>,
    })],
    presenters: { page: presenter },
  };
  const { host, navigation } = mount(app);
  await expect.poll(() => ctx).toBeTruthy();
  navigation.navigate("/home");
  await expect.poll(() => host.textContent).toBe("首页");
  finish(stored); await Promise.resolve(); await Promise.resolve();
  expect(ctx.signal.aborted).toBe(true); expect(transforms).toBe(0);
});

it("扩展校验和加工都不能改变 id 或显式 domain", async () => {
  const app: FormworkDefinition = {
    api, getSchema: () => ({ ...stored, domain: "cms" }),
    domains: { cms: defineDomain({ transformSchema: (ctx) => ({ ...ctx.schema, domain: "orders" }) }) },
    pages: [definePage({ router: "list", container: () => <p>错误内容</p> })],
    presenters: { page: presenter },
  };
  const { host } = mount(app);
  await expect.poll(() => host.textContent).toContain("INVALID_MODEL");
  expect(host.textContent).not.toContain("错误内容");
});
