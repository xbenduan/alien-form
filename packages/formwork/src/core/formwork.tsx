import {
  Router,
  MemoryRouter,
  Route,
  useLocation,
  useNavigate,
  useBeforeLeave,
} from "@solidjs/router";
import type { MemoryHistory } from "@solidjs/router";
import {
  createMemo,
  createSignal,
  ErrorBoundary,
  onCleanup,
  onMount,
  Show,
  Suspense,
} from "solid-js";
import type { Component, JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { createDataClient } from "../data/index";
import { FormworkError } from "../model/errors";
import {
  RuntimeContext,
  ModelProvider,
  component,
  createModelResource,
  useRuntime,
} from "./context";
import { parseLocation, recordPath } from "./routes";
import type { DomainDefinition, FormworkApplication, PageDefinition } from "./types";

const Domain: Component<{ definition: DomainDefinition; modelId: string }> = (props) => {
  const [model] = createModelResource(() => ({
    modelId: props.modelId,
    router: props.definition.router,
  }));
  const runtime = useRuntime();
  const Content: Component = () => {
    onMount(() => {
      const route = parseLocation(runtime.location().pathname);
      const scope = new URLSearchParams(runtime.location().search).get("scope") ?? "default";
      if (route.mode && !runtime.outlets.has(`${route.router}/${route.modelId}/${scope}`))
        throw new FormworkError("OPERATION_UNAVAILABLE", "当前布局没有挂载对应的 RecordOutlet");
    });
    return (
      <ModelProvider.Provider value={model()!}>
        <Dynamic component={props.definition.render} {...model()!} />
      </ModelProvider.Provider>
    );
  };
  return (
    <Suspense fallback={<Feedback kind="loading" />}>
      <Show when={model()}>
        <Content />
      </Show>
    </Suspense>
  );
};
const Page: Component<{ definition: PageDefinition }> = (props) => {
  const runtime = useRuntime();
  const abort = new AbortController();
  onCleanup(() => abort.abort());
  return (
    <Dynamic
      component={props.definition.render}
      router={props.definition.router}
      data={runtime.data}
      signal={abort.signal}
      navigate={runtime.navigate}
      confirm={runtime.confirm}
      guard={runtime.guard}
      query={() => new URLSearchParams(runtime.location().search)}
    />
  );
};
function Host() {
  const runtime = useRuntime();
  // 操作后缀及 query 的变化不重建 Domain；列表查询与打开的草稿各自持有 owner。
  const target = createMemo(() => {
    const route = parseLocation(runtime.location().pathname);
    return route.modelId ? recordPath(route.router, route.modelId) : `/${route.router}`;
  });
  return (
    <Show when={target()} keyed>
      {(_target) => {
        const route = parseLocation(runtime.location().pathname);
        const domain = runtime.app.domains.find((item) => item.router === route.router);
        const page = runtime.app.pages.find((item) => item.router === route.router);
        if (domain && route.modelId) return <Domain definition={domain} modelId={route.modelId} />;
        if (page && !route.modelId) return <Page definition={page} />;
        throw new FormworkError("NOT_FOUND", "页面不存在");
      }}
    </Show>
  );
}
/** 渲染 app 配置的加载、空态或错误组件。 */
export const Feedback: Component<{
  kind: "loading" | "empty" | "error";
  error?: unknown;
  retry?: () => void;
}> = (props) => {
  const runtime = useRuntime();
  return (
    <Dynamic component={component(runtime, runtime.app.ui.feedback?.[props.kind])} {...props} />
  );
};
const Root: Component<{ app: FormworkApplication; class?: string }> = (props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const data = createDataClient({ apis: props.app.apis });
  const guards = new Set<() => boolean>();
  const [portalTarget, setPortalTarget] = createSignal<HTMLElement>();
  const [confirmation, setConfirmation] = createSignal<{
    message: string;
    resolve: (value: boolean) => void;
  }>();
  let skipGuard = false;
  const runtime = {
    app: props.app,
    data,
    location: () => ({ pathname: location.pathname, search: location.search }),
    navigate: (path: string, options?: { replace?: boolean; force?: boolean }) => {
      skipGuard = !!options?.force;
      navigate(path, { replace: options?.replace });
      skipGuard = false;
    },
    confirm: (message: string) =>
      new Promise<boolean>((resolve) => {
        component(runtime, props.app.ui.feedback?.confirm);
        confirmation()?.resolve(false);
        setConfirmation({
          message,
          resolve: (value) => {
            setConfirmation(undefined);
            resolve(value);
          },
        });
      }),
    guard: (check: () => boolean) => {
      guards.add(check);
      return () => {
        guards.delete(check);
      };
    },
    outlets: new Set<string>(),
    portalTarget,
  };
  useBeforeLeave((event) => {
    if (skipGuard || ![...guards].some((check) => check())) return;
    event.preventDefault();
    void runtime.confirm("有未保存的修改，确定离开吗？").then((accepted) => {
      if (accepted) event.retry(true);
    });
  });
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if ([...guards].some((check) => check())) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  onMount(() => window.addEventListener("beforeunload", beforeUnload));
  onCleanup(() => {
    window.removeEventListener("beforeunload", beforeUnload);
    confirmation()?.resolve(false);
  });
  const Boundary: Component<{ children?: JSX.Element }> = (boundary) => (
    <ErrorBoundary
      fallback={(error, retry) => <Feedback kind="error" error={error} retry={retry} />}
    >
      {boundary.children}
    </ErrorBoundary>
  );
  const Content = () =>
    props.app.ui.shell ? (
      <Dynamic component={component(runtime, props.app.ui.shell)} data={data}>
        <Boundary>
          <Host />
        </Boundary>
      </Dynamic>
    ) : (
      <Boundary>
        <Host />
      </Boundary>
    );
  return (
    <RuntimeContext.Provider value={runtime}>
      <div class={props.class} data-formwork-root ref={setPortalTarget}>
        <Content />
        <Show when={confirmation()}>
          {(value) => (
            <Dynamic
              component={component(runtime, props.app.ui.feedback?.confirm)}
              message={value().message}
              confirm={() => value().resolve(true)}
              cancel={() => value().resolve(false)}
            />
          )}
        </Show>
      </div>
    </RuntimeContext.Provider>
  );
};
/** 可选 memoryHistory 用于嵌入式预览，不改变浏览器地址。 */
export type FormworkProps = {
  app: FormworkApplication;
  class?: string;
  memoryHistory?: MemoryHistory;
};
/** 在独立 Router 和数据环境中挂载应用；class 作为 app 原生 CSS 的作用域。 */
export const Formwork: Component<FormworkProps> = (props) => {
  const Routes = () => <Route path="*" component={() => null} />;
  return props.memoryHistory ? (
    <MemoryRouter
      history={props.memoryHistory}
      root={() => <Root app={props.app} class={props.class} />}
    >
      <Routes />
    </MemoryRouter>
  ) : (
    <Router root={() => <Root app={props.app} class={props.class} />}>
      <Routes />
    </Router>
  );
};
