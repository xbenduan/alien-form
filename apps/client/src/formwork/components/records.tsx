import { Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";
import type { ModelContext, RecordOperation } from "formwork";
import type { RecordEditorController, RecordListController } from "formwork/atom";
import { FilterBar } from "../../components/records/filter-bar";
import { RecordTable } from "../../components/records/record-table";
import { SelectControl } from "../../components/ui/select";
import { ErrorMessage, Message } from "../../components/ui/message";
import { Popconfirm } from "../../components/ui/popconfirm";
import { RecordRelations } from "../data/record-relations";
import { PageTopbar } from "../shell/page-topbar";
import { Icon } from "../shell/icons";

type ListProps = { controller: RecordListController; children?: JSX.Element };

/** 为默认列表提供关系选项缓存，并在页面操作期间保留列表状态。 */
export const ListLayout: Component<ListProps> = (props) => (
  <RecordRelations ctx={props.controller.model()!}>
    <div class="list-page" hidden={props.controller.operation()?.presentation === "page"}>
      {props.children}
    </div>
  </RecordRelations>
);

/** 展示模型名称与已授权的新建入口。 */
export const ListActions: Component<ListProps> = (props) => {
  const list = props.controller;
  const navigate = useNavigate();
  return (
    <Show when={list.operation()?.presentation !== "page"}>
      <PageTopbar
        title={
          <>
            <h1>{list.model()?.schema.title}</h1>
            <span class="page-meta">{list.total()} 条记录</span>
          </>
        }
        actions={
          <>
            <Show when={window.location.pathname !== "/model-preview"}>
              <button
                class="button secondary"
                onClick={() =>
                  navigate(`/models?modelId=${encodeURIComponent(list.model()!.modelId)}`)
                }
              >
                <Icon name="model" />
                查看模型
              </button>
            </Show>
            <Show when={list.allowed("create")}>
              <button class="button" onClick={() => list.openCreate()}>
                <Icon name="plus" />
                新建记录
              </button>
            </Show>
          </>
        }
      />
    </Show>
  );
};

/** 将筛选表单接入同一个列表查询状态。 */
export const ListFilters: Component<ListProps> = (props) => (
  <Show when={props.controller.model()} keyed>
    {(ctx) => (
      <FilterBar
        model={ctx.model}
        RenderItem={ctx.RenderItem}
        loading={props.controller.loading()}
        onQuery={props.controller.filter}
      />
    )}
  </Show>
);

/** 复用字段 renderer 展示快照数据，写入动作保留各行版本。 */
export const ListTable: Component<ListProps> = (props) => {
  const list = props.controller;
  return (
    <Show when={list.model()} keyed>
      {(ctx) => (
        <section class="panel data-panel">
          <div class="data-heading">
            <h2>记录列表</h2>
            <button class="text-button" disabled={list.loading()} onClick={list.refresh}>
              <Icon name="refresh" />
              刷新
            </button>
          </div>
          <RecordTable
            model={ctx.model}
            RenderItem={ctx.RenderItem}
            records={list.items().map((item) => ({ ...item.data, id: item.id }))}
            loading={list.loading()}
            sort={list.query().sort}
            onSort={list.sort}
            actions={(record) => {
              const id = String(record.id);
              return (
                <div class="actions">
                  <Show when={list.allowed("update")}>
                    <button class="text-button" onClick={() => list.openEdit(id)}>
                      编辑
                    </button>
                  </Show>
                  <Show when={list.allowed("read")}>
                    <button class="text-button" onClick={() => list.openDetail(id, "drawer")}>
                      详情
                    </button>
                  </Show>
                  <Show when={list.allowed("delete")}>
                    <button
                      class="text-button danger"
                      disabled={!!list.removing()}
                      onClick={() => {
                        const snapshot = list.items().find((item) => item.id === id);
                        if (snapshot) void list.delete(snapshot);
                      }}
                    >
                      {list.removing() === id ? "删除中…" : "删除"}
                    </button>
                  </Show>
                </div>
              );
            }}
          />
          {props.children}
        </section>
      )}
    </Show>
  );
};

/** 展示总量与页码，查询失败或加载时禁用翻页。 */
export const ListPagination: Component<ListProps> = (props) => {
  const list = props.controller;
  return (
    <div class="table-footer">
      <span class="muted">
        共 {list.error() ? "—" : list.total()} 条 · {list.query().page} / {list.pages()} 页
      </span>
      <div class="actions">
        <SelectControl
          class="page-size"
          label="每页记录数"
          value={String(list.query().pageSize)}
          options={[10, 20, 50].map((size) => ({ value: String(size), label: `${size} 条 / 页` }))}
          onChange={(size) => {
            if (size) list.pageSize(Number(size));
          }}
        />
        <button
          class="button secondary"
          disabled={list.loading() || !!list.error() || list.query().page <= 1}
          onClick={() => list.page(list.query().page - 1)}
        >
          上一页
        </button>
        <button
          class="button secondary"
          disabled={list.loading() || !!list.error() || list.query().page >= list.pages()}
          onClick={() => list.page(list.query().page + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
};

/** 提供详情的标题与关系标签加载环境。 */
export const DetailLayout: Component<{ model: ModelContext; children?: JSX.Element }> = (props) => (
  <RecordRelations ctx={props.model}>
    <div class="record-detail">
      <div class="record-heading">
        <h1 tabindex="-1">{props.model.schema.title}详情</h1>
      </div>
      <div class="detail-fields">{props.children}</div>
    </div>
  </RecordRelations>
);

/** 提交 controller 的独立草稿，并将字段校验焦点移到首个错误。 */
export const EditorLayout: Component<{
  controller: RecordEditorController;
  operation?: RecordOperation;
  children?: JSX.Element;
}> = (props) => {
  let form!: HTMLFormElement;
  const editor = props.controller;
  return (
    <RecordRelations ctx={editor.session()!.model}>
      <form
        class="record-form"
        ref={(element) => {
          form = element;
        }}
        onSubmit={async (event) => {
          event.preventDefault();
          await editor.submit();
          const invalid = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
          if (invalid) {
            Message.error("请检查表单中的字段");
            invalid.focus();
          }
        }}
      >
        <div class="record-heading">
          <h1 tabindex="-1">
            {editor.session()?.mode === "create" ? "新建" : "编辑"}
            {editor.session()?.model.schema.title}
          </h1>
        </div>
        <div class="record-fields">{props.children}</div>
        <div class="record-actions">
          <span>标记 * 的字段为必填项</span>
          <button type="submit" class="button" disabled={editor.saving()}>
            <Icon name="check" />
            {editor.saving() ? "正在保存…" : "保存"}
          </button>
        </div>
      </form>
    </RecordRelations>
  );
};

/** 展示统一的加载反馈。 */
export const Loading: Component = () => (
  <p class="query-loading" role="status">
    正在加载…
  </p>
);
/** 展示空查询结果。 */
export const Empty: Component = () => (
  <div class="table-empty">
    <Icon name="content" />
    <p>没有符合条件的记录</p>
  </div>
);
/** 将框架错误边界与请求失败接入全局 Message，并保留重试入口。 */
export const Failure: Component<{ error: unknown; retry?: () => unknown }> = (props) => (
  <>
    <ErrorMessage error={props.error} retry={props.retry} />
    <Show when={props.retry}>
      <button class="text-button" onClick={() => props.retry?.()}>
        重新加载
      </button>
    </Show>
  </>
);
/** 为删除和丢弃草稿提供可取消的确认界面。 */
export const Confirmation: Component<{
  message: string;
  confirm: () => void;
  cancel: () => void;
}> = (props) => {
  const anchor = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  return (
    <Popconfirm
      open
      anchor={anchor}
      message={props.message}
      onConfirm={props.confirm}
      onCancel={props.cancel}
    />
  );
};
