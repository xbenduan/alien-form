import { For, Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import { render } from "solid-js/web";
import { defineDomain, defineFormwork, definePage, Formwork } from "formwork";
import type { FieldContainerProps, FieldProps, PresenterProps } from "formwork";
import { Detail, Records } from "formwork/atom";
import type { RecordEditorController, RecordListController } from "formwork/atom";
import { apis } from "./api";
import "./style.css";

const Input: Component<FieldProps> = (props) => (
  <input
    aria-label={props.field.schema.title}
    value={String(props.value ?? "")}
    readOnly={props.readOnly}
    disabled={props.disabled}
    aria-invalid={!!props.errors.length}
    onInput={(event) => props.onChange(event.currentTarget.value)}
  />
);
const FieldContainer: Component<FieldContainerProps> = (props) => (
  <label>
    {props.title}
    {props.children}
    <For each={props.errors}>{(error) => <span role="alert">{error.message}</span>}</For>
  </label>
);
const Container: Component<{ children?: JSX.Element }> = (props) => (
  <section>{props.children}</section>
);
const Presenter: Component<PresenterProps> = (props) => (
  <section class="operation">
    {props.children}
    <button onClick={() => props.close()}>返回列表</button>
  </section>
);
const Editor: Component<{ controller: RecordEditorController; children?: JSX.Element }> = (
  props,
) => (
  <form
    onSubmit={(event) => {
      event.preventDefault();
      void props.controller.submit();
    }}
  >
    {props.children}
    <button type="submit" disabled={props.controller.saving()}>
      保存
    </button>
  </form>
);
type ListProps = { controller: RecordListController; children?: JSX.Element };
const Layout: Component<ListProps> = (props) => (
  <section hidden={!!props.controller.operation()}>{props.children}</section>
);
const Actions: Component<ListProps> = (props) => (
  <header>
    <h1>便笺</h1>
    <Show when={props.controller.allowed("create")}>
      <button onClick={() => props.controller.openCreate()}>新建记录</button>
    </Show>
  </header>
);
const Filters: Component<ListProps> = (props) => (
  <form
    onSubmit={(event) => {
      event.preventDefault();
      const value = String(new FormData(event.currentTarget).get("keyword") ?? "");
      props.controller.filter(
        value ? [{ field: "/title", operator: "contains", operand: value }] : [],
      );
    }}
  >
    <input name="keyword" aria-label="筛选标题" />
    <button type="submit">查询</button>
  </form>
);
const Table: Component<ListProps> = (props) => (
  <>
    <table>
      <thead>
        <tr>
          <th>
            <button
              onClick={() =>
                props.controller.sort({
                  field: "/title",
                  direction: props.controller.query().sort?.direction === "asc" ? "desc" : "asc",
                })
              }
            >
              标题 ↕
            </button>
          </th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <For each={props.controller.items()}>
          {(record) => (
            <tr>
              <td>{String(record.data.title)}</td>
              <td>
                <button onClick={() => props.controller.openDetail(record.id)}>详情</button>
                <button onClick={() => props.controller.openEdit(record.id)}>编辑</button>
                <button onClick={() => props.controller.delete(record)}>删除</button>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
    {props.children}
  </>
);
const Pagination: Component<ListProps> = (props) => (
  <footer>
    共 {props.controller.total()} 条 · 第 {props.controller.query().page} /{" "}
    {props.controller.pages()} 页
    <button
      disabled={props.controller.query().page <= 1 || props.controller.loading()}
      onClick={() => props.controller.page(props.controller.query().page - 1)}
    >
      上一页
    </button>
    <button
      disabled={
        props.controller.query().page >= props.controller.pages() || props.controller.loading()
      }
      onClick={() => props.controller.page(props.controller.query().page + 1)}
    >
      下一页
    </button>
  </footer>
);
const Confirm: Component<{ message: string; confirm: () => void; cancel: () => void }> = (
  props,
) => (
  <div class="confirmation" role="alertdialog" aria-label="确认操作" aria-modal="true">
    <p>{props.message}</p>
    <button autofocus onClick={props.cancel}>
      取消
    </button>
    <button onClick={props.confirm}>确定</button>
  </div>
);
const domains = [
  defineDomain({
    router: "list",
    render: () => <Records pageSize={5} detail={(operation) => <Detail operation={operation} />} />,
  }),
];
const pages = [
  definePage({
    router: "home",
    render: (ctx) => <button onClick={() => ctx.navigate("/list/notes")}>打开便笺</button>,
  }),
];
const app = defineFormwork({
  apis,
  domains,
  pages,
  components: {
    Input,
    FieldContainer,
    Container,
    Presenter,
    Editor,
    Layout,
    Actions,
    Filters,
    Table,
    Pagination,
    Confirm,
    Loading: () => <p role="status">加载中…</p>,
    Empty: () => <p>暂无记录</p>,
    Error: (props: { error: unknown; retry?: () => void }) => (
      <div role="alert">
        {String(props.error)}
        <button onClick={() => props.retry?.()}>重新加载</button>
      </div>
    ),
  },
  ui: {
    fieldContainer: "FieldContainer",
    types: {
      string: {
        form: { component: "Input" },
        filter: { component: "Input" },
        detail: { component: "Input" },
        table: { component: "Input" },
      },
    },
    records: {
      layout: "Layout",
      actions: "Actions",
      filter: "Filters",
      table: "Table",
      pagination: "Pagination",
    },
    detail: { layout: "Container" },
    editor: { layout: "Editor" },
    presenters: { page: "Presenter" },
    feedback: { loading: "Loading", empty: "Empty", error: "Error", confirm: "Confirm" },
  },
});
render(() => <Formwork app={app} class="notes-app" />, document.getElementById("root")!);
