import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js";
import type { Component } from "solid-js";
import { FormworkError } from "formwork";
import type { DataSchema, JsonValue, PageContext } from "formwork";
import { escapePointer, resolveSchema, schemaType } from "formwork/model";
import type { RecordPage, RecordQuery } from "../fn/records";
import { FilterItem, TableCell } from "../ui/field-container";
import { Select } from "../ui/fields";
import { Icon } from "../ui/icons";
import { SelectControl } from "../ui/select";

/** 以已提交查询和稳定记录 id 驱动 Filter、Table 与记录 Window。 */
export const List: Component<PageContext> = (ctx) => {
  const fields = Object.entries(ctx.model.data.properties).map(([name, original]) => ({
    name,
    schema: resolveSchema(original, ctx.model.data),
  }));
  const columns = fields.filter(({ name }) => name !== "id");
  const filters = fields.filter(
    ({ schema }) =>
      ["string", "number", "integer", "boolean", "null"].includes(schemaType(schema)) &&
      !schema.readOnly,
  );
  const querySchema: DataSchema = {
    type: "object",
    properties: Object.fromEntries(
      filters.map(({ name, schema }) => {
        const {
          default: _default,
          minLength: _min,
          maxLength: _max,
          pattern: _pattern,
          minimum: _minimum,
          maximum: _maximum,
          ...query
        } = schema as DataSchema & {
          minLength?: number;
          maxLength?: number;
          pattern?: string;
          minimum?: number;
          maximum?: number;
        };
        return [name, query as DataSchema];
      }),
    ),
  };
  const draft = ctx.createScope({ schema: querySchema, defaults: false });
  const [query, setQuery] = createSignal<RecordQuery>({ filters: {}, page: 1, pageSize: 10 });
  const [records, { refetch }] = createResource(
    query,
    (value) => ctx.fn.queryRecords(value) as Promise<RecordPage>,
  );
  const [failure, setFailure] = createSignal("");
  const [removing, setRemoving] = createSignal<string>();
  const Render = ctx.Render;
  // Solid Resource 在首次请求失败后读取值会抛错；局部错误状态应保留筛选和重试操作。
  const result = () => (records.error ? undefined : records());
  const totalPages = () => Math.max(1, Math.ceil((result()?.total ?? 0) / query().pageSize));
  // For 拥有每行 scope；相同 id 响应通过 reset 更新，而不是复用旧快照。
  const rowRecords = createMemo(() => {
    const rows = result()?.list ?? [];
    const ids = new Set<string>();
    for (const row of rows) {
      if (typeof row.id !== "string" || !row.id || ids.has(row.id))
        throw new FormworkError("INVALID_RECORD", "记录 id 缺失或重复");
      ids.add(row.id);
    }
    return rows;
  });
  const open = async (router: string, id?: string) => {
    setFailure("");
    try {
      const outcome = await ctx.open(router, { domain: ctx.domain, ...(id ? { id } : {}) });
      if (!ctx.signal.aborted && outcome.status === "completed") await refetch();
    } catch (error) {
      if (!ctx.signal.aborted) setFailure(error instanceof Error ? error.message : String(error));
    }
  };
  const Row: Component<{ id: string }> = (props) => {
    const scope = ctx.createScope({ readOnly: true, defaults: false });
    createEffect(() => {
      const record = rowRecords().find((row) => row.id === props.id);
      if (record) scope.reset(record);
    });
    return (
      <tr data-record-id={props.id}>
        <For each={columns}>
          {({ name, schema }) => (
            <td classList={{ "numeric-cell": ["number", "integer"].includes(schemaType(schema)) }}>
              <Render scope={scope} field={`/${escapePointer(name)}`} fieldContainer={TableCell} />
            </td>
          )}
        </For>
        <td class="operation-cell">
          <div class="actions">
            <button class="text-button" onClick={() => open("edit", props.id)}>
              编辑
            </button>
            <button class="text-button" onClick={() => open("detail", props.id)}>
              详情
            </button>
            <button
              class="text-button danger"
              disabled={removing() === props.id}
              onClick={async () => {
                if (removing()) return;
                setRemoving(props.id);
                try {
                  await ctx.fn.removeRecord(props.id);
                  if (!ctx.signal.aborted) await refetch();
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
        </td>
      </tr>
    );
  };
  const rowIds = createMemo(() => rowRecords().map((row) => row.id as string));
  return (
    <div class="list-page">
      <header class="page-header">
        <div class="page-title">
          <h1>{ctx.model.title}</h1>
          <span class="page-meta">
            {records.error ? "加载失败" : `${result()?.total ?? "…"} 条记录`}
          </span>
        </div>
        <div class="actions">
          <button
            class="button secondary"
            onClick={() => ctx.navigate("models", { domain: ctx.domain })}
          >
            <Icon name="model" />
            查看模型
          </button>
          <button class="button" onClick={() => open("add")}>
            <Icon name="plus" />
            新建记录
          </button>
        </div>
      </header>
      <form
        class="panel filters"
        aria-label="筛选记录"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery((value) => ({
            ...value,
            filters: draft.value() as Record<string, JsonValue>,
            page: 1,
          }));
        }}
      >
        <Render scope={draft} fieldContainer={FilterItem} components={{ Switch: Select }} />
        <div class="actions filter-actions">
          <button type="submit" class="button" disabled={records.loading}>
            <Icon name="filter" />
            查询
          </button>
          <button
            type="button"
            class="button secondary"
            onClick={() => {
              draft.reset({});
              setQuery((value) => ({ ...value, filters: {}, page: 1 }));
            }}
          >
            清空筛选
          </button>
        </div>
      </form>
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
        <div
          class="table-scroll"
          tabindex="0"
          aria-label="记录表格，可横向滚动"
          aria-busy={records.loading}
        >
          <table aria-label={`${ctx.model.title}记录`}>
            <thead>
              <tr>
                <For each={columns}>
                  {({ name, schema }) => (
                    <th
                      classList={{
                        "numeric-cell": ["number", "integer"].includes(schemaType(schema)),
                      }}
                      aria-sort={
                        query().sort?.field === name
                          ? query().sort?.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      <Show
                        when={!["object", "array"].includes(schemaType(schema))}
                        fallback={schema.title ?? name}
                      >
                        <button
                          class="text-button"
                          onClick={() =>
                            setQuery((value) => ({
                              ...value,
                              page: 1,
                              sort: {
                                field: name,
                                direction:
                                  value.sort?.field === name && value.sort.direction === "asc"
                                    ? "desc"
                                    : "asc",
                              },
                            }))
                          }
                        >
                          {schema.title ?? name}
                          <Show when={query().sort?.field === name}>
                            <span class="sort-indicator" aria-hidden="true">
                              {query().sort?.direction === "asc" ? "↑" : "↓"}
                            </span>
                          </Show>
                        </button>
                      </Show>
                    </th>
                  )}
                </For>
                <th class="operation-cell">操作</th>
              </tr>
            </thead>
            <tbody>
              <For each={rowIds()}>{(id) => <Row id={id} />}</For>
            </tbody>
          </table>
        </div>
        <Show when={records.loading}>
          <p class="query-loading" role="status">
            正在查询…
          </p>
        </Show>
        <Show when={!records.loading && !records.error && rowIds().length === 0}>
          <div class="table-empty">
            <Icon name={ctx.domain === "cms" ? "content" : "orders"} />
            <p>没有符合条件的记录</p>
            <span>清空筛选重新查询，或新建一条记录。</span>
          </div>
        </Show>
        <div class="table-footer">
          <span class="muted">
            共 {records.error ? "—" : (result()?.total ?? 0)} 条 · {query().page} / {totalPages()}{" "}
            页
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
                setQuery((value) => ({
                  ...value,
                  pageSize: Number(size),
                  page: 1,
                }))
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
              disabled={records.loading || !!records.error || query().page >= totalPages()}
              onClick={() => setQuery((value) => ({ ...value, page: value.page + 1 }))}
            >
              下一页
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
