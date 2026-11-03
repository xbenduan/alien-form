import {
  batch,
  createEffect,
  createRoot,
  createSignal,
  For,
  getOwner,
  onCleanup,
  runWithOwner,
  untrack,
} from "solid-js";
import type { Accessor, JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { useLocation, useNavigate } from "@solidjs/router";
import { FormworkError } from "../model/errors";
import { selectOpenMode } from "../model/definition-policy";
import { cloneJson } from "../model/pointer";
import { createRoutes, matchRoute, pageParams, routePath } from "../model/routes";
import type { OpenMode } from "../model/types";
import { createInstance } from "../runtime/instance";
import type { InstanceOptions } from "../runtime/instance";
import type {
  FormworkDefinition,
  PageDefinition,
  RouteParams,
  WindowOutcome,
} from "../runtime/types";

type HistoryState = {
  formwork?: { host: string; token: string; depth: number; caller?: string; openMode: OpenMode };
};
/** 向同一个 Host 注入浏览器或内存中的路径和历史导航。 */
export type NavigationAdapter = {
  location: Accessor<{ pathname: string; search: string; state?: HistoryState | null }>;
  navigate: (
    path: string | number,
    options?: { replace?: boolean; scroll?: boolean; state?: HistoryState },
  ) => void;
};
type Frame = {
  token: string;
  path: string;
  page: PageDefinition;
  window?: string;
  openMode: OpenMode;
  params: RouteParams;
  direct: boolean;
  depth: number;
  parent?: Frame;
  settled: boolean;
  resolve?: (outcome: WindowOutcome) => void;
  node: JSX.Element;
  model: ReturnType<typeof createInstance>["model"];
  stop: () => void;
  dispose: () => void;
  focus?: HTMLElement;
};
const safe = (action: () => void) => {
  try {
    action();
  } catch (error) {
    console.error("Formwork host cleanup:", error);
  }
};

/** 在 Router 常驻 root 下将浏览器路径交给通用 Host。 */
export function Host(props: { app: FormworkDefinition }) {
  const location = useLocation<HistoryState>();
  const navigate = useNavigate();
  return <FormworkHost app={props.app} navigation={{ location: () => location, navigate }} />;
}

/** 管理 Page、本地 Window、历史恢复与唯一终态，导航和数据源可独立替换。 */
export function FormworkHost(props: { app: FormworkDefinition; navigation: NavigationAdapter }) {
  const { app, navigation } = props;
  const owner = getOwner()!;
  const routes = createRoutes(app.pages);
  const hostId = crypto.randomUUID();
  const [frames, setFrames] = createSignal<readonly Frame[]>([]);
  const [missing, setMissing] = createSignal(false);
  let pendingRestore: string | undefined;
  let alive = true;
  const state = (frame: Frame): HistoryState => ({
    formwork: {
      host: hostId,
      token: frame.token,
      depth: frame.depth,
      caller: frame.parent?.token,
      openMode: frame.openMode,
    },
  });
  const cancelFrom = (index: number, outcome: WindowOutcome = { status: "cancelled" }) => {
    const old = [...untrack(frames)];
    const removed = old.splice(index);
    for (const frame of removed) {
      frame.settled = true;
      frame.stop();
    }
    for (const frame of removed.toReversed()) {
      safe(frame.dispose);
      frame.resolve?.(frame === removed[0] ? outcome : { status: "cancelled" });
    }
    setFrames(old);
    return removed;
  };
  const finish = (frame: Frame, outcome: WindowOutcome) => {
    if (!alive || frame.settled || frame.window === undefined) return;
    const all = [...untrack(frames)];
    const index = all.indexOf(frame);
    if (index < 0) return;
    const removed = all.filter((candidate) => {
      for (let current: Frame | undefined = candidate; current; current = current.parent)
        if (current === frame) return true;
      return false;
    });
    for (const child of removed) {
      child.settled = true;
      child.stop();
    }
    for (const child of removed.toReversed()) {
      safe(child.dispose);
      child.resolve?.(child === frame ? outcome : { status: "cancelled" });
    }
    setFrames(all.filter((child) => !removed.includes(child)));
    if (!removed.includes(all.at(-1)!)) return;
    const caller =
      frame.parent && untrack(frames).includes(frame.parent) ? frame.parent : undefined;
    pendingRestore = frame.token;
    if (caller) {
      navigation.navigate(caller.depth - all.at(-1)!.depth);
      queueMicrotask(() => {
        if (frame.focus?.isConnected) frame.focus.focus();
      });
    } else {
      const pageRoute = routes.find(
        (route) => route.router === frame.page.router && route.window === undefined,
      )!;
      navigation.navigate(
        routePath(routes, frame.page.router, pageParams(pageRoute, frame.params)),
        { replace: true, state: {} },
      );
    }
    return removed;
  };
  const create = (
    page: PageDefinition,
    params: RouteParams,
    path: string,
    window?: string,
    parent?: Frame,
    resolve?: Frame["resolve"],
    depth = 0,
    input: InstanceOptions = {},
  ): Frame => {
    const definition = window === undefined ? page : page.windows?.[window];
    if (!definition)
      throw new FormworkError("UNKNOWN_WINDOW", `未知 Window: ${page.router}/${window}`);
    const mode =
      parent && window !== undefined ? selectOpenMode(page.windows![window]!.openMode) : "page";
    const presenter = app.presenters[mode];
    if (!presenter) throw new FormworkError("MISSING_PRESENTER", `缺少 ${mode} Presenter`);
    const frame: Frame = {
      token: crypto.randomUUID(),
      path,
      page,
      window,
      openMode: mode,
      params: Object.freeze({ ...params }),
      parent,
      direct: window !== undefined && !parent,
      resolve,
      settled: false,
      depth,
      node: undefined,
      model: () => undefined,
      stop: () => {},
      dispose: () => {},
      focus: document.activeElement instanceof HTMLElement ? document.activeElement : undefined,
    };
    runWithOwner(owner, () =>
      createRoot((dispose) => {
        frame.dispose = dispose;
        const instance = createInstance(
          app,
          page,
          frame.params,
          {
            navigate: (router, values) => {
              const path = routePath(routes, router, values);
              cancelFrom(0);
              navigation.navigate(path, { state: {} });
            },
            open: async (name, options = {}) => {
              if (frame.settled) return Promise.resolve({ status: "cancelled" });
              if (!Object.hasOwn(page.windows ?? {}, name))
                throw new FormworkError("UNKNOWN_WINDOW", `未知 Window: ${page.router}/${name}`);
              const pageRoute = routes.find(
                (route) => route.router === page.router && route.window === undefined,
              )!;
              const inherited = pageParams(pageRoute, frame.params);
              for (const [key, value] of Object.entries(options.params ?? {}))
                if (
                  (Object.hasOwn(inherited, key) || key === "modelId") &&
                  inherited[key] !== value
                )
                  throw new FormworkError("INVALID_PARAMS", `不能修改所属 Page 参数: ${key}`);
              const values = { ...inherited, ...options.params };
              const path = routePath(routes, { router: page.router, window: name }, values);
              const initialValue = cloneJson(options.initialValue);
              return new Promise<WindowOutcome>((done) => {
                const child = create(
                  page,
                  values,
                  path,
                  name,
                  frame,
                  done,
                  (untrack(frames).at(-1)?.depth ?? 0) + 1,
                  { model: frame.model(), initialValue },
                );
                setFrames((all) => [...all, child]);
                navigation.navigate(path, { state: state(child) });
              });
            },
            complete: (value) => {
              if (window === undefined)
                throw new FormworkError("INVALID_OPERATION", "Page 不能 complete");
              finish(frame, { status: "completed", value });
            },
          },
          { ...input, window },
        );
        frame.stop = instance.stop;
        frame.model = instance.model;
        frame.node = (
          <Dynamic
            component={presenter}
            direct={frame.direct}
            window={window}
            close={() => finish(frame, { status: "cancelled" })}
          >
            {instance.output}
          </Dynamic>
        );
      }),
    );
    return frame;
  };
  createEffect(() => {
    const location = navigation.location();
    const path = location.pathname + location.search;
    const history = location.state?.formwork;
    untrack(() =>
      batch(() => {
        if (!alive) return;
        if (pendingRestore && history?.token === pendingRestore) return;
        pendingRestore = undefined;
        if (location.pathname === "/") {
          navigation.navigate("/home", { replace: true, state: {} });
          return;
        }
        const old = [...frames()];
        const existing =
          history?.host === hostId
            ? old.findIndex((frame) => frame.token === history.token && frame.path === path)
            : -1;
        if (existing >= 0) {
          if (existing < old.length - 1) {
            const focus = cancelFrom(existing + 1)[0]?.focus;
            queueMicrotask(() => {
              if (focus?.isConnected) focus.focus();
            });
          }
          setMissing(false);
          return;
        }
        const match = matchRoute(routes, path);
        if (!match) {
          cancelFrom(0);
          setMissing(true);
          return;
        }
        setMissing(false);
        const page = app.pages.find((page) => page.router === match.definition.router)!;
        const window = match.definition.window;
        const parent =
          window !== undefined && history?.host === hostId
            ? old.find(
                (frame) =>
                  frame.token === history.caller &&
                  frame.page === page &&
                  frame.params.modelId === match.params.modelId,
              )
            : undefined;
        if (parent) {
          const index = old.indexOf(parent);
          if (index < old.length - 1) cancelFrom(index + 1);
        } else cancelFrom(0);
        const frame = create(
          page,
          match.params,
          path,
          window,
          parent,
          undefined,
          history?.host === hostId ? history.depth : 0,
          { model: parent?.model() },
        );
        setFrames((all) => [...all, frame]);
        navigation.navigate(path, { replace: true, scroll: false, state: state(frame) });
      }),
    );
  });
  onCleanup(() => {
    alive = false;
    cancelFrom(0);
  });
  const hidden = (index: number) =>
    frames()
      .slice(index + 1)
      .some((frame) => frame.openMode === "page");
  return (
    <>
      <For each={frames()}>
        {(frame, index) => (
          <div
            hidden={hidden(index())}
            inert={index() < frames().length - 1}
            data-formwork-router={frame.page.router}
            data-formwork-window={frame.window}
          >
            {frame.node}
          </div>
        )}
      </For>
      {missing() && (
        <div role="alert">
          <p>未找到页面</p>
          <button onClick={() => navigation.navigate("/home", { state: {} })}>回到首页</button>
        </div>
      )}
    </>
  );
}

/** 创建可响应后退和前进的内存历史，供预览复用真实 Host。 */
export function createMemoryNavigation(initialPath: string): NavigationAdapter {
  const entry = (path: string, state?: HistoryState) => {
    const url = new URL(path, "https://formwork.invalid");
    return { pathname: url.pathname, search: url.search, state };
  };
  const history = [entry(initialPath)];
  let cursor = 0;
  const [location, setLocation] = createSignal(history[0]!);
  return {
    location,
    navigate(path, options = {}) {
      if (typeof path === "number") {
        cursor = Math.max(0, Math.min(history.length - 1, cursor + path));
      } else if (options.replace) history[cursor] = entry(path, options.state);
      else {
        history.splice(cursor + 1);
        history.push(entry(path, options.state));
        cursor++;
      }
      setLocation(history[cursor]!);
    },
  };
}
