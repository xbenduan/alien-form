import {
  createRoot,
  createSignal,
  ErrorBoundary,
  getOwner,
  onCleanup,
  runWithOwner,
  Show,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import { FormworkError, errorPayload } from "../model/errors";
import { cloneJson } from "../model/pointer";
import { fieldIssues, viewIssues } from "../model/schema";
import { pageParams, routeKey, createRoutes } from "../model/routes";
import type { JsonValue, RuntimeSchema } from "../model/types";
import { createRender } from "../render/render";
import { lifetime } from "./lifecycle";
import { bindFunctions, mergeDefaults } from "./resolve";
import { prepareModel } from "./model-context";
import type { ModelContext } from "./model-context";
import { createValueScope, scopeCell } from "./scope";
import type {
  ActionContext,
  FormworkDefinition,
  PageContext,
  PageDefinition,
  RenderDefaults,
  RouteParams,
  ScopeOptions,
  ValueScope,
  WindowLoadContext,
  WindowContext,
} from "./types";

type Navigation = Pick<ActionContext, "navigate" | "open" | "complete">;
/** 为 Window 注入所属模型快照、本地名称和复制后的输入。 */
export type InstanceOptions = { window?: string; model?: ModelContext; initialValue?: JsonValue };
const safe = (dispose: () => void) => {
  try {
    dispose();
  } catch (error) {
    console.error("Formwork instance cleanup:", error);
  }
};

/** 在挂载 owner 下依次加载和定制 schema；重试替换本次实例全部状态。 */
export function createInstance(
  app: FormworkDefinition,
  page: PageDefinition,
  params: RouteParams,
  navigation: Navigation,
  options: InstanceOptions = {},
) {
  const definition = options.window === undefined ? page : page.windows?.[options.window];
  if (!definition) throw new FormworkError("UNKNOWN_WINDOW", `未知 Window: ${page.router}/${options.window}`);
  const initialValue = cloneJson(options.initialValue);
  const target = { router: page.router, window: options.window };
  const pageRoute = createRoutes([page])[0]!;
  const parent = getOwner()!;
  const [loaded, setLoaded] = createSignal<{
    effective: RenderDefaults;
    schema?: RuntimeSchema;
    model?: ModelContext;
    value?: JsonValue;
    defaults: boolean;
    ctx: ActionContext;
    life: ReturnType<typeof lifetime>;
  }>();
  const [failure, setFailure] = createSignal<unknown>();
  const [attempt, setAttempt] = createSignal(0);
  let alive = true;
  let turn = 0;
  let stopLoading = () => {};
  let disposeLoading = () => {};
  const cancel = () => {
    stopLoading();
    safe(disposeLoading);
  };
  const start = () => {
    if (!alive) return;
    const current = ++turn;
    cancel();
    setLoaded(undefined);
    setFailure(undefined);
    setAttempt((value) => value + 1);
    runWithOwner(parent, () =>
      createRoot((dispose) => {
        disposeLoading = dispose;
        const life = lifetime();
        stopLoading = life.dispose;
        const ctx: ActionContext = {
          modelId: params.modelId,
          router: page.router,
          window: options.window,
          params: Object.freeze({ ...params }),
          api: app.api,
          signal: life.signal,
          fn: {},
          navigate: (...args) => {
            if (!life.alive()) throw new FormworkError("ABORTED", "Instance 已销毁");
            navigation.navigate(...args);
          },
          open: (...args) => {
            if (!life.alive()) return Promise.resolve({ status: "cancelled" });
            return navigation.open(...args);
          },
          complete: (value) => {
            if (life.alive()) navigation.complete(value);
          },
        };
        Promise.resolve()
          .then(async () => {
            const model = options.model ?? (!page.render
              ? await prepareModel(app, page, { ...ctx, window: undefined, params: pageParams(pageRoute, params) })
              : undefined);
            if (!life.alive()) return;
            const effective = mergeDefaults(model?.effective ?? mergeDefaults(app, page),
              ...(options.window === undefined ? [] : [definition]));
            const schema = model?.schema;
            ctx.domain = model?.domain;
            ctx.schema = schema;
            bindFunctions(effective, ctx);
            if (definition.render) return { effective, schema, model, ctx, life, defaults: false };
            if (!schema) throw new FormworkError("INVALID_DEFINITION", "模型 Window 缺少所属 Page schema");
            const fieldErrors = fieldIssues(schema.fields, Object.keys(effective.components ?? {}));
            if (fieldErrors.length)
              throw new FormworkError("INVALID_VIEW", "字段展示配置不合法", fieldErrors);
            const view = schema.views?.[routeKey(target)];
            if (view) {
              const issues = viewIssues(
                view,
                schema.data,
                Object.keys(effective.components ?? {}),
                schema.data,
                "",
                schema.fields,
              );
              if (issues.length)
                throw new FormworkError("INVALID_VIEW", "有效 View 不合法", issues);
            }
            const getter = "getValue" in definition ? definition.getValue : undefined;
            const value = getter
              ? await getter({ ...ctx, initialValue: cloneJson(initialValue) } as WindowLoadContext)
              : initialValue;
            return { effective, schema, model, value: cloneJson(value), defaults: !getter && initialValue === undefined, ctx, life };
          })
          .then((loaded) => {
            if (!loaded || !life.alive() || current !== turn || !alive) return;
            setLoaded(loaded);
          })
          .catch((error) => {
            if (!life.alive() || current !== turn || !alive) return;
            setFailure(error);
            cancel();
          });
      }),
    );
  };
  const dispose = () => {
    if (!alive) return;
    alive = false;
    turn++;
    cancel();
  };
  onCleanup(dispose);
  start();
  const Mounted = (props: { data: NonNullable<ReturnType<typeof loaded>> }) => {
    const { ctx, effective, schema, life, value, defaults } = props.data;
    let disposeContent = () => {};
    const node = createRoot((dispose) => {
      disposeContent = dispose;
      life.cleanups.add(dispose);
      const contentOwner = getOwner()!;
      if (definition.render) return <Dynamic component={definition.render} {...ctx} />;
      const checkOwner = () => {
        for (let current = getOwner(); current; current = current.owner)
          if (current === contentOwner) return;
        throw new FormworkError("INVALID_OWNER", "createScope 必须在当前 Instance 的 owner 下调用");
      };
      const createScope = (options: ScopeOptions = {}) => {
        checkOwner();
        const value = createValueScope(options, schema!.data, schema!.data);
        const cell = scopeCell(value);
        const stop = () => cell.stop();
        const cleanup = () => cell.dispose();
        life.stops.add(stop);
        life.cleanups.add(cleanup);
        onCleanup(() => {
          life.stops.delete(stop);
          life.cleanups.delete(cleanup);
        });
        return value;
      };
      const defaultScope: ValueScope = createScope({
        value,
        defaults,
        readOnly: "readOnly" in definition ? definition.readOnly : undefined,
      });
      const scope = () => defaultScope;
      const Render = createRender({
        ctx,
        components: effective.components ?? {},
        fieldContainer: effective.fieldContainer,
        scope,
        view: schema!.views?.[routeKey(target)],
      });
      const context: PageContext = {
        ...ctx,
        modelId: ctx.modelId!,
        schema: schema!,
        Render,
        createScope,
        get scope() {
          return scope();
        },
        get children() {
          return <Render />;
        },
      };
      return <Dynamic component={definition.container!} {...context as WindowContext} initialValue={cloneJson(initialValue)} />;
    });
    onCleanup(disposeContent);
    return node;
  };
  const output = () => (
    <Show when={attempt()} keyed>
      {(_attempt) => (
        <ErrorBoundary
          fallback={(error, reset) => (
            <div role="alert">
              <p>
                {errorPayload(error).code}: {errorPayload(error).message}
              </p>
              <button
                onClick={() => {
                  reset();
                  start();
                }}
              >
                重试
              </button>
            </div>
          )}
        >
          <Show
            when={!failure()}
            fallback={
              <div role="alert">
                <p>
                  {errorPayload(failure()).code}: {errorPayload(failure()).message}
                </p>
                <button onClick={start}>重试</button>
              </div>
            }
          >
            <Show when={loaded()} keyed fallback={<p role="status">正在加载…</p>}>
              {(data) => <Mounted data={data} />}
            </Show>
          </Show>
        </ErrorBoundary>
      )}
    </Show>
  );
  return {
    get output() { return output(); },
    model: () => loaded()?.model,
    stop: () => {
      stopLoading();
    },
    dispose,
  };
}
