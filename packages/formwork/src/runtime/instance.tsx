import { createRoot, createSignal, ErrorBoundary, getOwner, onCleanup, runWithOwner, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { FormworkError, errorPayload } from "../model/errors";
import { cloneJson } from "../model/pointer";
import { modelDocumentSchema, viewIssues } from "../model/schema";
import type { ModelDocument } from "../model/types";
import { createRender } from "../render/render";
import { lifetime } from "./lifecycle";
import { resolveDefinition } from "./resolve";
import { createValueScope, scopeCell } from "./scope";
import type { ActionContext, FormworkDefinition, LoadContext, PageContext, PageDefinition, RenderDefaults, RouteParams, ScopeOptions, ValueScope } from "./types";

type Navigation = Pick<ActionContext, "navigate" | "open" | "complete">;
const safe = (dispose: () => void) => { try { dispose(); } catch (error) { console.error("Formwork instance cleanup:", error); } };

// 加载 owner 与内容 owner 均属于本次挂载，重试会替换全部内容状态。
export function createInstance(app: FormworkDefinition, definition: PageDefinition, params: RouteParams, navigation: Navigation) {
  const parent = getOwner()!;
  const [loaded, setLoaded] = createSignal<{ effective: RenderDefaults; model?: ModelDocument; ctx: ActionContext; life: ReturnType<typeof lifetime> }>();
  const [failure, setFailure] = createSignal<unknown>();
  const [attempt, setAttempt] = createSignal(0);
  let alive = true;
  let turn = 0;
  let stopLoading = () => {};
  let disposeLoading = () => {};
  const cancel = () => { stopLoading(); safe(disposeLoading); };
  const start = () => {
    if (!alive) return;
    const current = ++turn;
    cancel();
    setLoaded(undefined);
    setFailure(undefined);
    setAttempt((value) => value + 1);
    runWithOwner(parent, () => createRoot((dispose) => {
      disposeLoading = dispose;
      const life = lifetime();
      stopLoading = life.dispose;
      const ctx: ActionContext = {
        domain: params.domain, params: Object.freeze({ ...params }), models: app.models, signal: life.signal, fn: {},
        navigate: (...args) => { if (!life.alive()) throw new FormworkError("ABORTED", "Instance 已销毁"); navigation.navigate(...args); },
        open: (...args) => { if (!life.alive()) return Promise.resolve({ status: "cancelled" }); return navigation.open(...args); },
        complete: (value) => { if (life.alive()) navigation.complete(value); },
      };
      Promise.resolve().then(async () => {
        const effective = await resolveDefinition(app, definition, ctx.domain);
        if (!life.alive()) return;
        ctx.fn = Object.fromEntries(Object.entries(effective.fn ?? {}).map(([name, fn]) => [name, (...args: unknown[]) => {
          if (!life.alive()) throw new FormworkError("ABORTED", "Instance 已销毁");
          return fn(ctx, ...args);
        }]));
        if (definition.render) return { effective, model: undefined, ctx, life };
        if (!ctx.domain) throw new FormworkError("PARAMS_REQUIRED", `模型页面 ${definition.router} 缺少 domain`);
        const input = effective.getSchema ? await effective.getSchema(ctx as LoadContext) : (await ctx.models.read(ctx.domain, { signal: life.signal })).document;
        const minimal = modelDocumentSchema.parse(input);
        const normalized = effective.schema!.parse(minimal);
        const model = cloneJson(modelDocumentSchema.parse(normalized) as never) as ModelDocument;
        if (model.id !== ctx.domain) throw new FormworkError("INVALID_MODEL", "URL domain 与模型 id 不一致");
        if (!effective.container) throw new FormworkError("INVALID_DEFINITION", `缺少 container: ${definition.router}`);
        const view = model.views?.[definition.router];
        if (view) {
          const issues = viewIssues(view, model.data, Object.keys(effective.components ?? {}));
          if (issues.length) throw new FormworkError("INVALID_VIEW", "有效 View 不合法", issues);
        }
        ctx.model = model;
        return { effective, model, ctx, life };
      }).then((loaded) => {
        if (!loaded || !life.alive() || current !== turn || !alive) return;
        setLoaded(loaded);
      }).catch((error) => {
        if (!life.alive() || current !== turn || !alive) return;
        setFailure(error);
        cancel();
      });
    }));
  };
  const dispose = () => { if (!alive) return; alive = false; turn++; cancel(); };
  onCleanup(dispose);
  start();
  const Mounted = (props: { data: NonNullable<ReturnType<typeof loaded>> }) => {
    const { ctx, effective, model, life } = props.data;
    let disposeContent = () => {};
    const node = createRoot((dispose) => {
      disposeContent = dispose;
      life.cleanups.add(dispose);
      const contentOwner = getOwner()!;
      if (definition.render) return <Dynamic component={definition.render} {...ctx} />;
      const checkOwner = () => {
        for (let current = getOwner(); current; current = current.owner) if (current === contentOwner) return;
        throw new FormworkError("INVALID_OWNER", "createScope 必须在当前 Instance 的 owner 下调用");
      };
      const createScope = (options: ScopeOptions = {}) => {
        checkOwner();
        const value = createValueScope(options, model!.data, model!.data);
        const cell = scopeCell(value);
        const stop = () => cell.stop();
        const cleanup = () => cell.dispose();
        life.stops.add(stop);
        life.cleanups.add(cleanup);
        onCleanup(() => { life.stops.delete(stop); life.cleanups.delete(cleanup); });
        return value;
      };
      let defaultScope: ValueScope | undefined;
      const scope = () => defaultScope ??= createScope();
      const Render = createRender({ ctx, components: effective.components ?? {}, fieldContainer: effective.fieldContainer, scope, view: model!.views?.[definition.router] });
      const context: PageContext = {
        ...ctx, domain: ctx.domain!, model: model!, Render, createScope,
        get scope() { return scope(); },
        get children() { return <Render />; },
      };
      return <Dynamic component={effective.container!} {...context} />;
    });
    onCleanup(disposeContent);
    return node;
  };
  const output = <Show when={attempt()} keyed>{(_attempt) =>
    <ErrorBoundary fallback={(error, reset) => <div role="alert"><p>{errorPayload(error).code}: {errorPayload(error).message}</p><button onClick={() => { reset(); start(); }}>重试</button></div>}>
      <Show when={!failure()} fallback={<div role="alert"><p>{errorPayload(failure()).code}: {errorPayload(failure()).message}</p><button onClick={start}>重试</button></div>}>
        <Show when={loaded()} keyed fallback={<p role="status">正在加载…</p>}>{(data) => <Mounted data={data} />}</Show>
      </Show>
    </ErrorBoundary>
  }</Show>;
  return { output, stop: () => { stopLoading(); }, dispose };
}
