import { createSignal, onCleanup, onMount, Show } from "solid-js";
import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { createInstance, FormworkError } from "formwork";
import type {
  ActionContext,
  FormworkDefinition,
  ModelDocument,
  PageDefinition,
  WindowOutcome,
} from "formwork";
import { errorPayload, isObject, modelDocumentSchema } from "formwork/model";
import { components } from "../components";
import * as recordFns from "../fn/records";
import { add, detail, edit, list } from "../schema-pages";
import { FormItem } from "../ui/field-container";
import { DrawerPresenter, ModalPresenter } from "../ui/presenters";
import { createPreviewApi } from "./model-preview-data";

/** 在独立画布中实时渲染 Schema，以临时记录完成全部预览交互。 */
export const ModelPreview: Component<ActionContext> = (ctx) => {
  const query = new URLSearchParams(location.search);
  const embedded = query.get("embedded") === "1";
  const revision = query.get("revision");
  const version = query.has("version") ? Number(query.get("version")) : undefined;
  if (
    !ctx.domain ||
    (!embedded && (version === undefined ? !revision : !Number.isSafeInteger(version) || version < 1))
  )
    throw new FormworkError("PARAMS_REQUIRED", "预览需要 domain 和审阅 revision 或发布版本");
  const domain = ctx.domain;
  const [schema, setSchema] = createSignal<ModelDocument>();
  const [message, setMessage] = createSignal("");
  let serialized = "";
  const acceptSchema = (input: unknown) => {
    const parsed = modelDocumentSchema.safeParse(input);
    if (!parsed.success || parsed.data.id !== domain) {
      setMessage(schema() ? "Schema 暂不可预览，保留上次有效内容。" : "请补全有效的 Schema 以开始预览。");
      return;
    }
    const next = JSON.stringify(parsed.data);
    if (next !== serialized) {
      serialized = next;
      setSchema(parsed.data);
    }
    setMessage("");
  };
  onMount(() => {
    if (embedded) {
      const receive = (event: MessageEvent) => {
        if (
          event.origin !== location.origin ||
          event.source !== window.parent ||
          !isObject(event.data) ||
          event.data.type !== "model-preview:definition" ||
          event.data.domain !== domain ||
          typeof event.data.source !== "string"
        )
          return;
        try {
          const input: unknown = JSON.parse(event.data.source);
          acceptSchema(isObject(input) ? input.document : undefined);
        } catch {
          setMessage(schema() ? "JSON 编辑中，保留上次有效内容。" : "请补全有效的 JSON 以开始预览。");
        }
      };
      window.addEventListener("message", receive);
      onCleanup(() => window.removeEventListener("message", receive));
      window.parent.postMessage({ type: "model-preview:ready", domain }, location.origin);
    } else {
      void (async () => {
        try {
          const document =
            version !== undefined
              ? (await ctx.api.models.version(domain, version, { signal: ctx.signal })).definition.document
              : (await ctx.api.models.draftSchema(domain, revision!, { signal: ctx.signal })).schema;
          if (!ctx.signal.aborted) acceptSchema(document);
        } catch (error) {
          if (!ctx.signal.aborted) setMessage(errorPayload(error).message);
        }
      })();
    }
  });
  const Preview: Component<{ schema: ModelDocument }> = (props) => {
    const model = props.schema;
    type WindowState = {
      router: string;
      params: { domain: string; id?: string };
      resolve: (outcome: WindowOutcome) => void;
      focus?: HTMLElement;
    };
    const [active, setActive] = createSignal<WindowState>();
    const finish = (outcome: WindowOutcome) => {
      const current = active();
      if (!current) return;
      setActive(undefined);
      current.resolve(outcome);
      queueMicrotask(() => {
        if (current.focus?.isConnected) current.focus.focus();
      });
    };
    const open: ActionContext["open"] = (router, params) => {
      if (![add, edit, detail].some((page) => page.router === router))
        return Promise.reject(new FormworkError("UNKNOWN_ROUTER", `未知预览 router ${router}`));
      finish({ status: "cancelled" });
      return new Promise<WindowOutcome>((resolve) => {
        setActive({
          router,
          params: { domain, id: params?.id },
          resolve,
          focus: document.activeElement instanceof HTMLElement ? document.activeElement : undefined,
        });
      });
    };
    const app: FormworkDefinition = {
      api: createPreviewApi(model),
      components,
      fn: recordFns,
      fieldContainer: FormItem,
      pages: [],
      presenters: { page: (props) => props.children },
    };
    const navigate: ActionContext["navigate"] = (router, params) => {
      if (router === "list") finish({ status: "cancelled" });
      else void open(router, params).catch((error) => setMessage(errorPayload(error).message));
    };
    const fromSchema = (definition: PageDefinition): PageDefinition => {
      if (definition.render)
        throw new FormworkError("INVALID_DEFINITION", "预览页面必须加载 Schema。");
      return { ...definition, getSchema: () => model };
    };
    const listInstance = createInstance(
      app,
      fromSchema(list),
      { domain },
      { navigate, open, complete: () => {} },
    );
    const Window: Component<{ state: WindowState }> = (props) => {
      const state = props.state;
      const original = [add, edit, detail].find((page) => page.router === state.router)!;
      const instance = createInstance(
        app,
        fromSchema(original),
        state.params,
        { navigate, open, complete: (value) => finish({ status: "completed", value }) },
      );
      return (
        <Dynamic
          component={original.presentation === "drawer" ? DrawerPresenter : ModalPresenter}
          direct={false}
          close={() => finish({ status: "cancelled" })}
        >
          {instance.output}
        </Dynamic>
      );
    };
    onMount(() => {
      const initial = query.get("router");
      if (!embedded && initial && initial !== "list")
        void open(initial, { domain, ...(query.get("id") ? { id: query.get("id")! } : {}) })
          .catch((error) => setMessage(errorPayload(error).message));
    });
    onCleanup(() => {
      active()?.resolve({ status: "cancelled" });
    });
    return (
      <>
        {listInstance.output}
        <Show when={active()} keyed>{(state) => <Window state={state} />}</Show>
      </>
    );
  };
  return (
    <div class="preview-content">
      <Show when={!embedded}>
        <p class="preview-notice">模拟数据 · 所有操作仅在当前预览中生效</p>
      </Show>
      <Show when={message()}><p class="preview-status" role="status">{message()}</p></Show>
      <Show when={schema()} keyed fallback={!message() ? <p role="status">正在准备预览…</p> : undefined}>
        {(document) => <Preview schema={document} />}
      </Show>
    </div>
  );
};
