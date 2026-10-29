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
import type { JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { useLocation, useNavigate } from "@solidjs/router";
import { FormworkError } from "../model/errors";
import { matchRoute, routePath } from "../model/routes";
import { createInstance } from "../runtime/instance";
import type {
  FormworkDefinition,
  PageDefinition,
  RouteParams,
  WindowDefinition,
  WindowOutcome,
} from "../runtime/types";

type Frame = {
  token: string;
  path: string;
  definition: PageDefinition | WindowDefinition;
  params: RouteParams;
  direct: boolean;
  depth: number;
  parent?: Frame;
  settled: boolean;
  resolve?: (outcome: WindowOutcome) => void;
  node: JSX.Element;
  stop: () => void;
  dispose: () => void;
  focus?: HTMLElement;
};
type HistoryState = {
  formwork?: { host: string; token: string; depth: number; caller?: string; callerPath?: string };
};
const isWindow = (definition: PageDefinition): definition is WindowDefinition =>
  "presentation" in definition;
const safe = (action: () => void) => {
  try {
    action();
  } catch (error) {
    console.error("Formwork host cleanup:", error);
  }
};

// Host 属于 Router 的常驻 root，路径匹配只交付快照。
export function Host(props: { app: FormworkDefinition }) {
  const app = props.app;
  const owner = getOwner()!;
  const location = useLocation<HistoryState>();
  const navigate = useNavigate();
  const definitions = [...app.pages, ...(app.windows ?? [])];
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
      callerPath: frame.parent?.path,
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
    if (!alive || frame.settled) return;
    const all = [...untrack(frames)];
    const index = all.indexOf(frame);
    if (index < 0) return;
    const descendant = (candidate: Frame) => {
      for (let parent: Frame | undefined = candidate; parent; parent = parent.parent)
        if (parent === frame) return true;
      return false;
    };
    const removed = all.filter(descendant);
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
    if (caller) {
      pendingRestore = frame.token;
      navigate(caller.depth - all.at(-1)!.depth);
      queueMicrotask(() => {
        if (caller && frame.focus?.isConnected) frame.focus.focus();
      });
    } else {
      const target = isWindow(frame.definition) ? frame.definition.returnTo : "home";
      pendingRestore = frame.token;
      navigate(routePath(definitions, target, frame.params), { replace: true, state: {} });
    }
  };
  const create = (
    definition: PageDefinition,
    params: RouteParams,
    path: string,
    parent?: Frame,
    direct = false,
    resolve?: Frame["resolve"],
    depth = 0,
  ): Frame => {
    const frame: Frame = {
      token: crypto.randomUUID(),
      path,
      definition,
      params: Object.freeze({ ...params }),
      parent,
      direct,
      resolve,
      settled: false,
      depth,
      node: undefined,
      stop: () => {},
      dispose: () => {},
      focus: document.activeElement instanceof HTMLElement ? document.activeElement : undefined,
    };
    runWithOwner(owner, () =>
      createRoot((dispose) => {
        frame.dispose = dispose;
        const instance = createInstance(app, definition, frame.params, {
          navigate: (router, values) => {
            const target = routePath(definitions, router, values);
            cancelFrom(0);
            navigate(target, { state: {} });
          },
          open: (router, values = {}) => {
            if (frame.settled) return Promise.resolve({ status: "cancelled" });
            const target = definitions.find((item) => item.router === router);
            if (!target)
              return Promise.reject(new FormworkError("UNKNOWN_ROUTER", `未知 router ${router}`));
            if (!isWindow(target))
              return Promise.reject(new FormworkError("INVALID_OPERATION", "open 只接受 Window"));
            const targetPath = routePath(definitions, router, values);
            return new Promise<WindowOutcome>((done) => {
              const child = create(
                target,
                values,
                targetPath,
                frame,
                false,
                done,
                (untrack(frames).at(-1)?.depth ?? 0) + 1,
              );
              setFrames((all) => [...all, child]);
              navigate(targetPath, { state: state(child) });
            });
          },
          complete: (value) => {
            if (!isWindow(definition))
              throw new FormworkError("INVALID_OPERATION", "Page 不能 complete");
            finish(frame, { status: "completed", value });
          },
        });
        frame.stop = instance.stop;
        const presenter = isWindow(definition)
          ? app.presenters[definition.presentation]
          : app.presenters.page;
        if (!presenter)
          throw new FormworkError(
            "INVALID_DEFINITION",
            `缺少 ${isWindow(definition) ? definition.presentation : "page"} Presenter`,
          );
        frame.node = (
          <Dynamic
            component={presenter}
            direct={direct}
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
    const path = location.pathname + location.search;
    const history = location.state?.formwork;
    untrack(() =>
      batch(() => {
        if (!alive) return;
        if (pendingRestore && history?.token === pendingRestore) return;
        pendingRestore = undefined;
        if (location.pathname === "/") {
          navigate("/home", { replace: true, state: {} });
          return;
        }
        const old = [...frames()];
        const existing =
          history?.host === hostId
            ? old.findIndex((frame) => frame.token === history.token && frame.path === path)
            : -1;
        if (existing >= 0) {
          if (existing < old.length - 1) {
            const removed = cancelFrom(existing + 1);
            const focus = removed[0]?.focus;
            queueMicrotask(() => {
              if (focus?.isConnected) focus.focus();
            });
          }
          setMissing(false);
          return;
        }
        const match = matchRoute(definitions, path);
        if (!match) {
          cancelFrom(0);
          setMissing(true);
          return;
        }
        setMissing(false);
        const definition = match.definition as PageDefinition;
        const parent =
          isWindow(definition) && history?.host === hostId
            ? old.find((frame) => frame.token === history.caller)
            : undefined;
        if (parent) {
          const index = old.indexOf(parent);
          if (index < old.length - 1) cancelFrom(index + 1);
        } else cancelFrom(0);
        const frame = create(
          definition,
          match.params,
          path,
          parent,
          isWindow(definition) && !parent,
          undefined,
          history?.host === hostId ? history.depth : 0,
        );
        setFrames((all) => [...all, frame]);
        navigate(path, { replace: true, scroll: false, state: state(frame) });
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
      .some((frame) => isWindow(frame.definition) && frame.definition.presentation === "page");
  return (
    <>
      <For each={frames()}>
        {(frame, index) => (
          <div
            hidden={hidden(index())}
            inert={index() < frames().length - 1}
            data-formwork-router={frame.definition.router}
          >
            {frame.node}
          </div>
        )}
      </For>
      {missing() && (
        <div role="alert">
          <p>未找到页面</p>
          <button onClick={() => navigate("/home", { state: {} })}>回到首页</button>
        </div>
      )}
    </>
  );
}
