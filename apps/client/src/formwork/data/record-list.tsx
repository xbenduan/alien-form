import { createEffect, createMemo, createResource, createSignal, Show } from "solid-js";
import type { Component } from "solid-js";
import { FormworkError } from "formwork";
import type { PageContext, RecordPage, RecordQuery } from "formwork";
import { Icon } from "../shell/icons";
import { PageTopbar } from "../shell/page-topbar";
import { SelectControl } from "../../components/ui/select";
import { FilterBar } from "../../components/records/filter-bar";
import { RecordTable } from "../../components/records/record-table";
import { RecordRelations } from "./record-relations";

/** 编排记录查询、分页和本地 Window，list 与 tree-list 共用同一记录流程。 */
export const RecordList: Component<{
  ctx: PageContext;
  parentId?: string;
  onRecordsChanged?: () => void;
}> = (props) => {
  const ctx = props.ctx;
  const [query, setQuery] = createSignal<RecordQuery>({ clauses: [], page: 1, pageSize: 10 });
  createEffect(() => {
    const parentId = props.parentId;
    setQuery((value) => ({ ...value, parentId, page: 1 }));
  });
  const [records, { refetch }] = createResource(
    query,
    (value) => ctx.fn.queryRecords(value) as Promise<RecordPage>,
  );
  const result = () => (records.error ? undefined : records());
  const rows = createMemo(() => {
    const rows = result()?.list ?? [];
    const ids = new Set<string>();
    for (const row of rows) {
      if (typeof row.id !== "string" || !row.id || ids.has(row.id))
        throw new FormworkError("INVALID_RECORD", "记录 id 缺失或重复");
      ids.add(row.id);
    }
    return rows;
  });
  const pages = () => Math.max(1, Math.ceil((result()?.total ?? 0) / query().pageSize));
  const [failure, setFailure] = createSignal("");
  const [removing, setRemoving] = createSignal<string>();
  const refresh = async () => {
    await refetch();
    props.onRecordsChanged?.();
  };
  const open = async (name: string, id?: string) => {
    setFailure("");
    try {
      const outcome = await ctx.open(name, {
        params: id ? { id } : undefined,
        initialValue: id ? rows().find((row) => row.id === id) : undefined,
      });
      if (!ctx.signal.aborted && outcome.status === "completed") await refresh();
    } catch (error) {
      if (!ctx.signal.aborted) setFailure(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <RecordRelations ctx={ctx}>
      <div class="list-page">
        <PageTopbar
          title={
            <>
              <h1>{ctx.schema.title}</h1>
              <span class="page-meta">
                {records.error ? "加载失败" : `${result()?.total ?? "…"} 条记录`}
              </span>
            </>
          }
          actions={
            <>
              <Show when={ctx.schema.tree}>
                <button
                  class="button secondary"
                  onClick={() =>
                    ctx.navigate(ctx.router === "tree-list" ? "list" : "tree-list", {
                      modelId: ctx.modelId,
                    })
                  }
                >
                  {ctx.router === "tree-list" ? "列表视图" : "树形视图"}
                </button>
              </Show>
              <Show when={!window.location.pathname.startsWith("/model-preview/")}>
                <button
                  class="button secondary"
                  onClick={() => ctx.navigate("models", { modelId: ctx.modelId })}
                >
                  <Icon name="model" />
                  查看模型
                </button>
              </Show>
              <button class="button" onClick={() => open("add")}>
                <Icon name="plus" />
                新建记录
              </button>
            </>
          }
        />
        <FilterBar
          model={ctx.model}
          RenderItem={ctx.RenderItem}
          loading={records.loading}
          onQuery={(clauses) => setQuery((value) => ({ ...value, clauses, page: 1 }))}
        />
        <Show when={failure()}>
          <p role="alert">{failure()}</p>
        </Show>
        <Show when={records.error}>
          <p role="alert">
            {String(records.error)}{" "}
            <button class="text-button" onClick={() => refetch()}>
              重试查询
            </button>
          </p>
        </Show>
        <section class="panel data-panel">
          <div class="data-heading">
            <h2>记录列表</h2>
            <button class="text-button" disabled={records.loading} onClick={() => refetch()}>
              <Icon name="refresh" />
              刷新
            </button>
          </div>
          <RecordTable
            model={ctx.model}
            RenderItem={ctx.RenderItem}
            records={rows()}
            loading={records.loading}
            sort={query().sort}
            onSort={(sort) => setQuery((value) => ({ ...value, sort, page: 1 }))}
            actions={(record) => (
              <div class="actions">
                <button class="text-button" onClick={() => open("edit", String(record.id))}>
                  编辑
                </button>
                <button class="text-button" onClick={() => open("detail", String(record.id))}>
                  详情
                </button>
                <button
                  class="text-button danger"
                  disabled={removing() === record.id}
                  onClick={async () => {
                    if (removing()) return;
                    setRemoving(String(record.id));
                    setFailure("");
                    try {
                      await ctx.fn.removeRecord(record.id);
                      if (!ctx.signal.aborted) await refresh();
                    } catch (error) {
                      if (!ctx.signal.aborted)
                        setFailure(error instanceof Error ? error.message : String(error));
                    } finally {
                      if (!ctx.signal.aborted) setRemoving(undefined);
                    }
                  }}
                >
                  删除
                </button>
              </div>
            )}
          />
          <Show when={records.loading}>
            <p class="query-loading" role="status">
              正在查询…
            </p>
          </Show>
          <Show when={!records.loading && !records.error && !rows().length}>
            <div class="table-empty">
              <Icon name="content" />
              <p>没有符合条件的记录</p>
              <span>清空筛选重新查询，或新建一条记录。</span>
            </div>
          </Show>
          <div class="table-footer">
            <span class="muted">
              共 {records.error ? "—" : (result()?.total ?? 0)} 条 · {query().page} / {pages()} 页
            </span>
            <div class="actions">
              <SelectControl
                class="page-size"
                label="每页记录数"
                value={String(query().pageSize)}
                options={[10, 20, 50].map((size) => ({
                  value: String(size),
                  label: `${size} 条 / 页`,
                }))}
                onChange={(size) =>
                  setQuery((value) => ({ ...value, pageSize: Number(size), page: 1 }))
                }
              />
              <button
                class="button secondary"
                disabled={records.loading || !!records.error || query().page <= 1}
                onClick={() => setQuery((value) => ({ ...value, page: value.page - 1 }))}
              >
                上一页
              </button>
              <button
                class="button secondary"
                disabled={records.loading || !!records.error || query().page >= pages()}
                onClick={() => setQuery((value) => ({ ...value, page: value.page + 1 }))}
              >
                下一页
              </button>
            </div>
          </div>
        </section>
      </div>
    </RecordRelations>
  );
};
