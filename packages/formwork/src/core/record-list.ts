import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
  onCleanup,
  untrack,
} from "solid-js";
import type { Accessor } from "solid-js";
import { FormworkError } from "../model/errors";
import type { OpenMode, QueryClause, RecordQuery } from "../model/types";
import type { RecordSnapshot } from "../data/index";
import { createModelResource, useRuntime } from "./context";
import { parseLocation, recordPath } from "./routes";
import type { ModelOptions, RecordOperation, RecordSlots } from "./types";

/** 配置一个记录集合；同一 Domain 内的多个集合需要不同 scopeKey。 */
export type RecordListOptions = ModelOptions & { scopeKey?: string; pageSize?: number };
/** 管理查询、分页、操作与取消；叶子 atom 只消费此实例，不重复请求。 */
export function createRecordList(options: Accessor<RecordListOptions> = () => ({})) {
  const runtime = useRuntime();
  const [model, { refetch: reloadModel }] = createModelResource(options);
  const [query, setQuery] = createSignal<RecordQuery>({
    clauses: [],
    page: 1,
    pageSize: options().pageSize ?? 10,
  });
  const [refreshKey, setRefreshKey] = createSignal(0);
  const [failure, setFailure] = createSignal<unknown>();
  const [removing, setRemoving] = createSignal<string>();
  const [slots, setSlots] = createSignal<RecordSlots>();
  const [operation, setOperation] = createSignal<RecordOperation>();
  const [localTarget, setLocalTarget] = createSignal<{
    mode: RecordOperation["mode"];
    recordId?: string;
    token: string;
  }>();
  const [openRevision, setOpenRevision] = createSignal(0);
  let read: AbortController | undefined;
  let write: AbortController | undefined;
  let operationAbort: AbortController | undefined;
  let defaultPresentation: OpenMode = "page";
  let requested: { path: string; presentation: OpenMode; token: string } | undefined;
  const checks = new Set<() => boolean>();
  let releaseGuard: (() => void) | undefined;
  let releaseOutlet: (() => void) | undefined;
  let previousModel: string | undefined;
  const scopeKey = () => options().scopeKey ?? "default";
  const refresh = () => {
    if (result.error instanceof FormworkError && result.error.code === "SCHEMA_CONFLICT")
      void reloadModel();
    else setRefreshKey((key) => key + 1);
  };
  const allowed = (mode: "read" | "create" | "update" | "delete") => {
    const ctx = model();
    if (!ctx?.snapshot.capabilities.actions[mode]) return false;
    if (mode === "read") return !!runtime.data.apis.records.get && slots()?.detail !== false;
    if (mode === "delete") return !!runtime.data.apis.records.delete;
    return (
      !!runtime.data.apis.records[mode] &&
      slots()?.[mode === "update" ? "edit" : "create"] !== false
    );
  };
  createEffect(
    on(
      () => model()?.modelId,
      (modelId) => {
        if (previousModel && previousModel !== modelId)
          setQuery({ clauses: [], page: 1, pageSize: options().pageSize ?? 10 });
        previousModel = modelId;
        setFailure(undefined);
        write?.abort();
        setRemoving(undefined);
      },
    ),
  );
  const [result] = createResource(
    () => {
      const context = model();
      return context && { context, query: query(), refresh: refreshKey() };
    },
    async ({ context, query }) => {
      read?.abort();
      read = new AbortController();
      const result = await runtime.data.query(
        { modelId: context.modelId, query },
        { signal: read.signal },
      );
      if (result.items.some((item) => item.schemaRevision !== context.snapshot.schemaRevision))
        throw new FormworkError("SCHEMA_CONFLICT", "模型已更新，请重新打开此页面");
      const ids = new Set(result.items.map((item) => item.id));
      if (ids.size !== result.items.length)
        throw new FormworkError("INVALID_RESPONSE", "查询结果存在重复记录 id");
      // 删除最后一条后回到仍有效的末页。
      const last = Math.max(1, Math.ceil(result.total / query.pageSize));
      if (query.page > last) setQuery((current) => ({ ...current, page: last }));
      return result;
    },
  );
  const unsubscribe = runtime.data.subscribe((change) => {
    if (change.modelId === untrack(model)?.modelId) refresh();
  });
  const close = async (committed = false) => {
    if (
      !committed &&
      [...checks].some((check) => check()) &&
      !(await runtime.confirm("有未保存的修改，确定关闭吗？"))
    )
      return false;
    const current = operation();
    if (!current) return true;
    const ctx = current.model;
    requested = undefined;
    if (ctx.router && parseLocation(runtime.location().pathname).router === ctx.router)
      runtime.navigate(recordPath(ctx.router, ctx.modelId), {
        force: true,
        replace: current.direct,
      });
    else setLocalTarget(undefined);
    return true;
  };
  const target = createMemo(
    () => {
      openRevision();
      const ctx = model();
      if (!ctx) return undefined;
      const route = parseLocation(runtime.location().pathname);
      if (ctx.router && route.router === ctx.router && route.modelId === ctx.modelId) {
        const scope = new URLSearchParams(runtime.location().search).get("scope") ?? "default";
        if (scope !== scopeKey() || !route.mode) return undefined;
        return {
          mode: route.mode,
          recordId: route.recordId,
          token:
            requested?.path === runtime.location().pathname
              ? requested.token
              : runtime.location().pathname,
        };
      }
      return localTarget();
    },
    undefined,
    {
      equals: (a, b) => a?.mode === b?.mode && a?.recordId === b?.recordId && a?.token === b?.token,
    },
  );
  createEffect(() => {
    const active = target();
    const ctx = model();
    const registered = slots();
    operationAbort?.abort();
    releaseGuard?.();
    checks.clear();
    setOperation(undefined);
    if (!active || !ctx || !registered) return;
    const permission =
      active.mode === "detail" ? "read" : active.mode === "edit" ? "update" : "create";
    if (!allowed(permission)) {
      setFailure(new FormworkError("OPERATION_UNAVAILABLE", "当前记录操作不可用"));
      return;
    }
    const abort = new AbortController();
    operationAbort = abort;
    const direct = !requested;
    const next: RecordOperation = {
      modelId: ctx.modelId,
      recordId: active.recordId,
      mode: active.mode,
      operationId: crypto.randomUUID(),
      model: ctx,
      signal: abort.signal,
      presentation: direct ? "page" : (requested?.presentation ?? defaultPresentation),
      direct,
      close: () => close(),
      complete: () => {
        if (!abort.signal.aborted) void close(true);
      },
      guard: (check) => {
        checks.add(check);
        return () => {
          checks.delete(check);
        };
      },
    };
    releaseGuard = runtime.guard(
      () => !abort.signal.aborted && [...checks].some((check) => check()),
    );
    setOperation(next);
  });
  onCleanup(() => {
    read?.abort();
    write?.abort();
    operationAbort?.abort();
    unsubscribe();
    releaseGuard?.();
    releaseOutlet?.();
  });
  const open = async (
    mode: RecordOperation["mode"],
    recordId?: string,
    presentation?: OpenMode,
  ) => {
    const ctx = model();
    if (!ctx || !slots()) throw new FormworkError("OPERATION_UNAVAILABLE", "请先挂载 RecordOutlet");
    if (!allowed(mode === "detail" ? "read" : mode === "edit" ? "update" : "create"))
      throw new FormworkError("OPERATION_UNAVAILABLE", "此操作未授权或未接入");
    if (mode !== "create" && !recordId) throw new FormworkError("INVALID_INPUT", "缺少 recordId");
    if (
      [...checks].some((check) => check()) &&
      !(await runtime.confirm("有未保存的修改，确定切换记录吗？"))
    )
      return;
    setFailure(undefined);
    const token = crypto.randomUUID();
    if (ctx.router) {
      const path = recordPath(ctx.router, ctx.modelId, mode, recordId);
      requested = { path, presentation: presentation ?? defaultPresentation, token };
      const suffix = scopeKey() === "default" ? "" : `?scope=${encodeURIComponent(scopeKey())}`;
      runtime.navigate(path + suffix, { force: true });
      setOpenRevision((value) => value + 1);
    } else {
      const activate = () => {
        requested = { path: "", presentation: presentation ?? defaultPresentation, token };
        setLocalTarget({ mode, recordId, token });
      };
      activate();
    }
  };
  return {
    model,
    query,
    result,
    items: () => (result.error ? [] : (result()?.items ?? [])),
    total: () => (result.error ? 0 : (result()?.total ?? 0)),
    loading: () => model.loading || result.loading,
    error: () => failure() ?? model.error ?? result.error,
    removing,
    operation,
    allowed,
    refresh,
    pages: () => Math.max(1, Math.ceil((result()?.total ?? 0) / query().pageSize)),
    filter: (clauses: QueryClause[]) => setQuery((value) => ({ ...value, clauses, page: 1 })),
    sort: (sort: RecordQuery["sort"]) => setQuery((value) => ({ ...value, sort, page: 1 })),
    page: (page: number) => setQuery((value) => ({ ...value, page: Math.max(1, page) })),
    pageSize: (pageSize: number) => setQuery((value) => ({ ...value, pageSize, page: 1 })),
    openDetail: (id: string, presentation?: OpenMode) => open("detail", id, presentation),
    openEdit: (id: string, presentation?: OpenMode) => open("edit", id, presentation),
    openCreate: (presentation?: OpenMode) => open("create", undefined, presentation),
    async delete(record: RecordSnapshot) {
      if (removing()) return;
      const ctx = model();
      if (!ctx || !allowed("delete"))
        throw new FormworkError("OPERATION_UNAVAILABLE", "不允许删除");
      if (!(await runtime.confirm("确定删除这条记录吗？"))) return;
      write = new AbortController();
      setRemoving(record.id);
      setFailure(undefined);
      try {
        await runtime.data.delete(
          {
            modelId: ctx.modelId,
            recordId: record.id,
            ifSchemaRevision: ctx.snapshot.schemaRevision,
            ifRecordRevision: record.revision,
          },
          { signal: write.signal },
        );
      } catch (error) {
        if (!write.signal.aborted) setFailure(error);
      } finally {
        if (!write.signal.aborted) setRemoving(undefined);
      }
    },
    registerOutlet(value: RecordSlots, presentation: OpenMode = "page") {
      if (slots())
        throw new FormworkError("DUPLICATE_OUTLET", "一个 controller 只能挂载一个 RecordOutlet");
      const ctx = model();
      if (!ctx) throw new FormworkError("MODEL_REQUIRED", "请在模型就绪后挂载 RecordOutlet");
      const key = `${ctx.router}/${ctx.modelId}/${scopeKey()}`;
      if (runtime.outlets.has(key))
        throw new FormworkError("DUPLICATE_OUTLET", `重复 scopeKey ${scopeKey()}`);
      runtime.outlets.add(key);
      defaultPresentation = presentation;
      setSlots(value);
      releaseOutlet = () => {
        runtime.outlets.delete(key);
        setSlots(undefined);
      };
      return releaseOutlet;
    },
  };
}
/** 保存可供多个 atom 共享的列表状态与操作。 */
export type RecordListController = ReturnType<typeof createRecordList>;
