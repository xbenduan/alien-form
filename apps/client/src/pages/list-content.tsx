import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js";
import type { Component } from "solid-js";
import { FormworkError } from "formwork";
import type { DataSchema, JsonValue, PageContext } from "formwork";
import { escapePointer, resolveSchema, schemaType } from "formwork/model";
import type { RecordPage, RecordQuery } from "../fn/records";
import { FilterItem, TableCell } from "../ui/field-container";
import { Select } from "../ui/fields";

/** 以已提交查询和稳定记录 id 驱动 Filter、Table 与记录 Window。 */
export const List: Component<PageContext> = (ctx) => {
  const fields = Object.entries(ctx.model.data.properties).map(([name, original]) => ({ name, schema: resolveSchema(original, ctx.model.data) }));
  const filters = fields.filter(({ schema }) => ["string", "number", "integer", "boolean", "null"].includes(schemaType(schema)) && !schema.readOnly);
  const querySchema: DataSchema = { type: "object", properties: Object.fromEntries(filters.map(({ name, schema }) => {
    const { default: _default, minLength: _min, maxLength: _max, pattern: _pattern, minimum: _minimum, maximum: _maximum, ...query } = schema as DataSchema & { minLength?: number; maxLength?: number; pattern?: string; minimum?: number; maximum?: number };
    return [name, query as DataSchema];
  })) };
  const draft = ctx.createScope({ schema: querySchema, defaults: false });
  const [query, setQuery] = createSignal<RecordQuery>({ filters: {}, page: 1, pageSize: 10 });
  const [records, { refetch }] = createResource(query, (value) => ctx.fn.queryRecords(value) as Promise<RecordPage>);
  const [failure, setFailure] = createSignal("");
  const [removing, setRemoving] = createSignal<string>();
  const Render = ctx.Render;
  const totalPages = () => Math.max(1, Math.ceil((records()?.total ?? 0) / query().pageSize));
  // For 拥有每行 scope；相同 id 响应通过 reset 更新，而不是复用旧快照。
  const rowRecords = createMemo(() => {
    const result = records()?.list ?? [];
    const ids = new Set<string>();
    for (const row of result) {
      if (typeof row.id !== "string" || !row.id || ids.has(row.id)) throw new FormworkError("INVALID_RECORD", "记录 id 缺失或重复");
      ids.add(row.id);
    }
    return result;
  });
  const open = async (router: string, id?: string) => {
    try {
      const outcome = await ctx.open(router, { domain: ctx.domain, ...(id ? { id } : {}) });
      if (!ctx.signal.aborted && outcome.status === "completed") await refetch();
    } catch (error) { if (!ctx.signal.aborted) setFailure(error instanceof Error ? error.message : String(error)); }
  };
  const Row: Component<{ id: string }> = (props) => {
    const scope = ctx.createScope({ readOnly: true, defaults: false });
    createEffect(() => {
      const record = rowRecords().find((row) => row.id === props.id);
      if (record) scope.reset(record);
    });
    return <tr data-record-id={props.id}><For each={fields}>{({ name }) => <td><Render scope={scope} field={`/${escapePointer(name)}`} fieldContainer={TableCell} /></td>}</For>
      <td><div class="actions"><button class="text-button" onClick={() => open("edit", props.id)}>编辑</button><button class="text-button" onClick={() => open("detail", props.id)}>详情</button>
        <button class="text-button danger" disabled={removing() === props.id} onClick={async () => {
          if (removing()) return; setRemoving(props.id);
          try { await ctx.fn.removeRecord(props.id); if (!ctx.signal.aborted) await refetch(); }
          catch (error) { if (!ctx.signal.aborted) setFailure(error instanceof Error ? error.message : String(error)); }
          finally { if (!ctx.signal.aborted) setRemoving(undefined); }
        }}>删除</button></div></td>
    </tr>;
  };
  const rowIds = createMemo(() => rowRecords().map((row) => row.id as string));
  return <div>
    <header class="page-header"><div><div class="eyebrow">RECORDS / {ctx.domain.toUpperCase()}</div><h1>{ctx.model.title}</h1></div><div class="actions">
      <button class="button secondary" onClick={() => ctx.navigate("home")}>首页</button><button class="button secondary" onClick={() => ctx.navigate("models", { domain: ctx.domain })}>查看模型</button><button class="button" onClick={() => open("add")}>新建记录</button>
    </div></header>
    <section class="panel filters"><Render scope={draft} fieldContainer={FilterItem} components={{ Switch: Select }} />
      <div class="actions mt-5"><button class="button" onClick={() => setQuery((value) => ({ ...value, filters: draft.value() as Record<string, JsonValue>, page: 1 }))}>查询</button>
        <button class="button secondary" onClick={() => { draft.reset({}); setQuery((value) => ({ ...value, filters: {}, page: 1 })); }}>清空筛选</button></div>
    </section>
    <Show when={failure()}><p role="alert">{failure()}</p></Show>
    <Show when={records.error}><p role="alert">{String(records.error)} <button class="text-button" onClick={() => refetch()}>重试查询</button></p></Show>
    <section class="panel p-0"><div class="table-scroll"><table><thead><tr><For each={fields}>{({ name, schema }) => <th>
      <Show when={!["object", "array"].includes(schemaType(schema))} fallback={schema.title ?? name}><button class="text-button" onClick={() => setQuery((value) => ({ ...value, page: 1, sort: { field: name, direction: value.sort?.field === name && value.sort.direction === "asc" ? "desc" : "asc" } }))}>{schema.title ?? name}</button></Show>
    </th>}</For><th>操作</th></tr></thead><tbody><For each={rowIds()}>{(id) => <Row id={id} />}</For></tbody></table></div>
      <Show when={records.loading}><p class="p-4" role="status">正在查询…</p></Show><Show when={!records.loading && rowIds().length === 0}><p class="p-4 muted">没有符合条件的记录</p></Show>
      <div class="table-footer"><span class="muted">共 {records()?.total ?? 0} 条 · 第 {query().page} / {totalPages()} 页</span><div class="actions">
        <button class="button secondary" disabled={query().page <= 1} onClick={() => setQuery((value) => ({ ...value, page: value.page - 1 }))}>上一页</button>
        <button class="button secondary" disabled={query().page >= totalPages()} onClick={() => setQuery((value) => ({ ...value, page: value.page + 1 }))}>下一页</button>
      </div></div>
    </section>
  </div>;
};
