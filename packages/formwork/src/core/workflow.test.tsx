import { afterEach, expect, it } from "vitest";
import { For, Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import { render } from "solid-js/web";
import { defineDomain, defineFormwork, definePage } from "./define";
import { Formwork } from "./formwork";
import type { FieldProps } from "../runtime/types";
import type { ModelSnapshot, FormworkApis, RecordSnapshot } from "../data";
import type { RecordListController } from "./record-list";
import type { RecordEditorController } from "./record-editor";
import type { FormworkDefinition, PresenterProps, SchemaContext } from "./types";
import { Records } from "../atom/records";
import { Detail } from "../atom/record";
import { FormworkError } from "../model/errors";

const stops: (() => void)[] = [];
const original = location.pathname + location.search;
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  history.replaceState({}, "", original);
});
function fixture() {
  let revision = 1;
  let queryCount = 0;
  let getCount = 0;
  const records = new Map<string, RecordSnapshot>([
    ["one", { id: "one", data: { title: "原始标题" }, revision: "1", schemaRevision: "s1" }],
  ]);
  const snapshot: ModelSnapshot = {
    schema: {
      schemaVersion: 1,
      id: "books",
      domain: "cms",
      title: "图书",
      data: {
        title: { type: "string", required: true },
        note: { type: "string" },
      },
    },
    schemaRevision: "s1",
    capabilities: {
      actions: { read: true, create: true, update: true, delete: true },
      fields: Object.fromEntries(
        ["/title", "/note"].map((path) => [
          path,
          {
            read: true,
            create: true,
            update: true,
            filter: ["eq"],
            sort: true,
          },
        ]),
      ),
    },
  };
  const apis: FormworkApis = {
    models: { get: async () => structuredClone(snapshot) },
    records: {
      get: async ({ recordId }) => {
        getCount++;
        return structuredClone(records.get(recordId)!);
      },
      query: async () => {
        queryCount++;
        return { items: structuredClone([...records.values()]), total: records.size };
      },
      create: async ({ data }) => {
        const record = {
          id: `new-${++revision}`,
          data,
          revision: String(revision),
          schemaRevision: "s1",
        };
        records.set(record.id, record);
        return record;
      },
      update: async ({ recordId, changes, ifRecordRevision }) => {
        const old = records.get(recordId)!;
        if (old.revision !== ifRecordRevision)
          throw new FormworkError("RECORD_CONFLICT", "记录已修改");
        const data = { ...old.data, ...changes.set };
        for (const path of changes.unset ?? []) delete data[path.slice(1)];
        const record = { ...old, data, revision: String(++revision) };
        records.set(recordId, record);
        return record;
      },
      delete: async ({ recordId }) => {
        records.delete(recordId);
        return { id: recordId, deleted: true };
      },
    },
  };
  let controller!: RecordListController;
  const Container: Component<{ children?: JSX.Element }> = (props) => <>{props.children}</>;
  const Input: Component<FieldProps> = (props) => (
    <input
      aria-label={props.field.path}
      value={String(props.value ?? "")}
      disabled={props.disabled}
      readOnly={props.readOnly}
      onInput={(event) => props.onChange(event.currentTarget.value)}
    />
  );
  const definition: FormworkDefinition = {
    apis,
    domains: [defineDomain({ router: "list", render: () => <Records presentation="drawer" /> })],
    pages: [],
    components: {
      Container,
      Input,
      Layout: (props: { controller: RecordListController; children?: JSX.Element }) => {
        controller = props.controller;
        return <div data-list>{props.children}</div>;
      },
      Actions: (props: { controller: RecordListController }) => (
        <button onClick={() => props.controller.openCreate()}>新建</button>
      ),
      Table: (props: { controller: RecordListController; children?: JSX.Element }) => (
        <>
          <For each={props.controller.items()}>
            {(record) => (
              <div>
                <span>{record.data.title as string}</span>
                <button onClick={() => props.controller.openEdit(record.id)}>编辑</button>
                <button onClick={() => props.controller.openDetail(record.id)}>详情</button>
                <button onClick={() => props.controller.delete(record)}>删除</button>
              </div>
            )}
          </For>
          {props.children}
        </>
      ),
      Presenter: (props: PresenterProps) => (
        <aside data-operation={props.operation.operationId} data-direct={props.direct}>
          {props.children}
          <button onClick={() => props.close()}>关闭</button>
        </aside>
      ),
      Editor: (props: { children?: JSX.Element; controller: RecordEditorController }) => (
        <div>
          {props.children}
          <button disabled={props.controller.saving()} onClick={() => props.controller.submit()}>
            保存
          </button>
        </div>
      ),
      Error: (props: { error?: unknown }) => <p role="alert">{String(props.error)}</p>,
      Loading: () => <span>加载中</span>,
      Empty: () => <span>空</span>,
      Confirm: (props: { confirm: () => void; cancel: () => void }) => (
        <div role="dialog">
          <button onClick={props.confirm}>确认放弃</button>
          <button onClick={props.cancel}>保留修改</button>
        </div>
      ),
    },
    ui: {
      types: {
        string: {
          form: { component: "Input" },
          detail: { component: "Input" },
          table: { component: "Input" },
          filter: { component: "Input" },
        },
      },
      fieldContainer: "Container",
      records: {
        layout: "Layout",
        filter: "Container",
        actions: "Actions",
        table: "Table",
        pagination: "Container",
      },
      editor: { layout: "Editor" },
      detail: { layout: "Container" },
      presenters: { page: "Presenter", drawer: "Presenter" },
      feedback: { loading: "Loading", error: "Error", empty: "Empty", confirm: "Confirm" },
    },
  };
  const element = document.createElement("div");
  const mount = (path = "/list/books") => {
    history.replaceState({}, "", path);
    document.body.append(element);
    const dispose = render(() => <Formwork app={defineFormwork(definition)} />, element);
    stops.push(() => {
      dispose();
      element.remove();
    });
  };
  const button = (label: string) => {
    const node = [...element.querySelectorAll("button")].find((node) => node.textContent === label);
    if (!node) throw new Error(`缺少按钮 ${label}：${element.textContent}`);
    node.click();
  };
  const input = (value: string) => {
    const elementInput = element.querySelector<HTMLInputElement>('input[aria-label="/title"]')!;
    elementInput.value = value;
    elementInput.dispatchEvent(new Event("input", { bubbles: true }));
  };
  return {
    definition,
    mount,
    button,
    input,
    element,
    records,
    snapshot,
    controller: () => controller,
    counts: () => ({ queryCount, getCount }),
  };
}

it("list 保存刷新同一列表，编辑读取完整快照且使用起始 revision", async () => {
  const f = fixture();
  f.mount();
  await expect.poll(() => f.element.textContent).toContain("原始标题");
  f.button("编辑");
  await expect.poll(() => f.element.querySelector("input")).toBeTruthy();
  f.input("新标题");
  f.button("保存");
  await expect.poll(() => f.element.querySelector("aside")).toBeNull();
  await expect.poll(() => f.element.textContent).toContain("新标题");
  expect(f.records.get("one")?.revision).toBe("2");
  expect(f.counts().getCount).toBe(1);
  expect(f.counts().queryCount).toBe(2);
});

it("关闭 dirty 编辑器可以取消；确认后丢弃，重新打开创建新操作", async () => {
  const f = fixture();
  f.mount();
  await expect.poll(() => f.element.textContent).toContain("原始标题");
  f.button("编辑");
  await expect.poll(() => f.element.querySelector("input")).toBeTruthy();
  const firstId = f.element.querySelector("aside")!.getAttribute("data-operation");
  f.input("未保存");
  f.button("关闭");
  await expect.poll(() => f.element.querySelector('[role="dialog"]')).toBeTruthy();
  f.button("保留修改");
  expect(f.element.querySelector<HTMLInputElement>("input")!.value).toBe("未保存");
  f.button("关闭");
  f.button("确认放弃");
  await expect.poll(() => f.element.querySelector("aside")).toBeNull();
  f.button("编辑");
  await expect
    .poll(() => f.element.querySelector<HTMLInputElement>("input")?.value)
    .toBe("原始标题");
  expect(f.element.querySelector("aside")!.getAttribute("data-operation")).not.toBe(firstId);
});

it("冲突保留编辑草稿，不关闭或刷新列表", async () => {
  const f = fixture();
  f.mount();
  await expect.poll(() => f.element.textContent).toContain("原始标题");
  f.button("编辑");
  await expect.poll(() => f.element.querySelector("input")).toBeTruthy();
  f.input("我的修改");
  f.records.set("one", { ...f.records.get("one")!, revision: "other" });
  f.button("保存");
  await expect
    .poll(() => f.element.querySelector('[role="alert"]')?.textContent)
    .toContain("记录已修改");
  expect(f.element.querySelector<HTMLInputElement>("input")!.value).toBe("我的修改");
  expect(f.counts().queryCount).toBe(1);
});

it("详情直达立即挂载出口，并在 page Presenter 中显示独立只读记录", async () => {
  const f = fixture();
  f.mount("/list/books/detail/one");
  await expect.poll(() => f.element.querySelector("aside")).toBeTruthy();
  await expect
    .poll(() => f.element.querySelector<HTMLInputElement>("input")?.value)
    .toBe("原始标题");
  expect(f.element.querySelector("aside")!.getAttribute("data-direct")).toBe("true");
  expect(f.element.querySelector<HTMLInputElement>("input")!.readOnly).toBe(true);
  f.button("关闭");
  await expect.poll(() => location.pathname).toBe("/list/books");
});

it("app → Domain → 局部加工按顺序运行且不修改源 schema", async () => {
  const f = fixture();
  const order: string[] = [];
  f.definition.transformSchema = (ctx) => {
    order.push("app");
    ctx.schema.title = "app";
    return ctx;
  };
  const transform = (ctx: SchemaContext) => {
    order.push("local");
    expect(ctx.schema.title).toBe("domain");
    return ctx;
  };
  f.definition.domains = [
    defineDomain({
      router: "list",
      transformSchema: (ctx) => {
        order.push("domain");
        ctx.schema.title = "domain";
        return ctx;
      },
      render: () => (
        <Records
          detail={(operation) => <Detail operation={operation} transformSchema={transform} />}
        />
      ),
    }),
  ];
  f.mount("/list/books/detail/one");
  await expect.poll(() => f.element.querySelector("input")).toBeTruthy();
  expect(order).toEqual(["app", "domain", "local"]);
  expect(f.snapshot.schema.title).toBe("图书");
  expect(f.snapshot.schema.data.title.ui).toBeUndefined();
});

it("Page 与 Domain 同名时报错，业务 domain 不参与路由匹配", () => {
  const f = fixture();
  f.definition.pages = [
    definePage({ router: "list", render: () => <Show when={true}>页面</Show> }),
  ];
  expect(() => defineFormwork(f.definition)).toThrow(/重复 router/);
});
