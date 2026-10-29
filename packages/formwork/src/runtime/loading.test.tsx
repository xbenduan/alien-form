import { afterEach, expect, it } from "vitest";
import { render } from "solid-js/web";
import { defineDomain, defineFormwork, definePage, defineWindow } from "./define";
import type { DomainSchemaContext, PageContext, PageLoadContext } from "./types";
import type { ModelDocument } from "../model/types";
import { createFormworkApi } from "../model/http";
import { modelDocumentSchema } from "../model/schema";

const stored: ModelDocument = {
  id: "orders",
  title: "数据库标题",
  data: { type: "object", properties: { name: { type: "string", default: "原值" } } },
};
const api = createFormworkApi({
  url: "/api/v1",
  fetch: async () => Response.json({ schema: stored, version: 1, revision: "published-1" }),
});
const loader = async (ctx: PageLoadContext) =>
  (await ctx.api.runtime.schema(ctx.domain, { signal: ctx.signal })).schema;
const original = location.pathname + location.search;
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  history.replaceState({}, "", original);
});
const mount = (App: ReturnType<typeof defineFormwork>, path: string) => {
  history.replaceState({}, "", path);
  const element = document.createElement("div");
  document.body.append(element);
  dispose = render(() => <App.render />, element);
  return element;
};

it("Page 先加载与代码校验，Domain 使用 ctx.schema 并保留函数 props", async () => {
  const order: string[] = [];
  let calls = 0;
  const action = () => calls++;
  const domain = defineDomain({
    schema: modelDocumentSchema.refine((input) => {
      order.push("validator");
      return input.title === "数据库标题";
    }),
    getSchema: (ctx) => {
      order.push("domain");
      expect(ctx.schema.title).toBe("数据库标题");
      ctx.schema.title = "定制标题";
      return {
        ...ctx.schema,
        views: { list: { component: "Button", props: { onClick: action } } },
      };
    },
    components: { Button: (props) => <button onClick={props.onClick}>代码事件</button> },
  });
  const app = defineFormwork({
    api,
    pages: [
      definePage({
        router: "list",
        path: "/list/:domain",
        getSchema: async (ctx) => {
          order.push("page");
          return loader(ctx);
        },
        domains: { orders: domain },
        container: (ctx) => (
          <>
            <h1>{ctx.schema.title}</h1>
            {ctx.children}
          </>
        ),
      }),
    ],
    presenters: { page: (props) => props.children },
  });
  const dom = mount(app, "/list/orders");
  await expect.poll(() => dom.querySelector("button")).toBeTruthy();
  expect(order).toEqual(["page", "validator", "domain"]);
  expect(stored.title).toBe("数据库标题");
  expect(dom.textContent).toContain("定制标题");
  expect(calls).toBe(0);
  dom.querySelector("button")!.click();
  expect(calls).toBe(1);
});

it("两个 Window 独立加工同一个后端文档，无 Domain 的 Page 直接加载", async () => {
  let caller!: PageContext;
  const windows: PageContext[] = [];
  const app = defineFormwork({
    api,
    pages: [
      definePage({
        router: "list",
        path: "/list/:domain",
        getSchema: loader,
        container: (ctx) => {
          caller = ctx;
          return <h1>{ctx.schema.title}</h1>;
        },
      }),
    ],
    windows: [
      defineWindow({
        router: "edit",
        path: "/edit/:domain",
        presentation: "modal",
        returnTo: "list",
        getSchema: loader,
        domains: {
          orders: defineDomain({
            getSchema: (ctx) => {
              ctx.schema.title += `-${windows.length}`;
              return ctx.schema;
            },
          }),
        },
        container: (ctx) => {
          windows.push(ctx);
          return <p>{ctx.schema.title}</p>;
        },
      }),
    ],
    presenters: {
      page: (props) => props.children,
      modal: (props) => <aside>{props.children}</aside>,
    },
  });
  mount(app, "/list/orders");
  await expect.poll(() => caller).toBeTruthy();
  const one = caller.open("edit", { domain: "orders" });
  await expect.poll(() => windows.length).toBe(1);
  const two = caller.open("edit", { domain: "orders" });
  await expect.poll(() => windows.length).toBe(2);
  expect(windows.map((ctx) => ctx.schema.title)).toEqual(["数据库标题-0", "数据库标题-1"]);
  windows[0]!.schema.data.properties.name!.title = "第一份";
  expect(windows[1]!.schema.data.properties.name!.title).toBeUndefined();
  expect(stored.data.properties.name!.title).toBeUndefined();
  windows[0]!.complete(1);
  expect(await one).toEqual({ status: "completed", value: 1 });
  windows[1]!.complete(2);
  expect(await two).toEqual({ status: "completed", value: 2 });
  await expect.poll(() => location.pathname).toBe("/list/orders");
});

it("已销毁加载不会调用 Domain 或挂载内容，transform 错误进入可重试边界", async () => {
  let finish!: (model: ModelDocument) => void;
  let context!: PageLoadContext;
  let transforms = 0;
  const app = defineFormwork({
    api,
    pages: [
      definePage({ router: "home", render: () => <p>首页</p> }),
      definePage({
        router: "list",
        path: "/list/:domain",
        getSchema: (ctx) => {
          context = ctx;
          return new Promise<ModelDocument>((done) => {
            finish = done;
          });
        },
        domains: {
          orders: defineDomain({
            getSchema: (ctx) => {
              transforms++;
              return ctx.schema;
            },
          }),
        },
        container: () => <p>迟到内容</p>,
      }),
    ],
    presenters: { page: (props) => props.children },
  });
  const dom = mount(app, "/list/orders");
  await expect.poll(() => context).toBeTruthy();
  context.navigate("home");
  await expect.poll(() => dom.textContent).toContain("首页");
  finish(stored);
  await Promise.resolve();
  expect(context.signal.aborted).toBe(true);
  expect(transforms).toBe(0);

  dispose!();
  let fail = true;
  const broken = defineFormwork({
    api,
    pages: [
      definePage({
        router: "list",
        path: "/list/:domain",
        getSchema: loader,
        domains: {
          orders: defineDomain({
            getSchema: (ctx: DomainSchemaContext) => {
              if (fail) throw new Error("定制失败");
              return ctx.schema;
            },
          }),
        },
        container: (ctx) => <p>{ctx.schema.title}</p>,
      }),
    ],
    presenters: { page: (props) => props.children },
  });
  const next = mount(broken, "/list/orders");
  await expect.poll(() => next.textContent).toContain("定制失败");
  fail = false;
  next.querySelector("button")!.click();
  await expect.poll(() => next.textContent).toContain("数据库标题");
});
