import { createSignal, onCleanup, onMount, Show } from "solid-js";
import type { Component } from "solid-js";
import { createMemoryNavigation, FormworkHost, FormworkError } from "formwork";
import type { ActionContext, FormworkDefinition, ModelDocument, PresenterProps } from "formwork";
import {
  createRoutes,
  errorPayload,
  isObject,
  modelDocumentSchema,
  routePath,
} from "formwork/model";
import list from "../list";
import treeList from "../tree-list";
import { modelDefaults } from "../../formwork/defaults";
import { DrawerPresenter } from "../../formwork/presenters/drawer";
import { ModalPresenter } from "../../formwork/presenters/modal";
import { PageWindow } from "../../formwork/shell/page-window";
import { createPreviewApi } from "./api";

const PreviewPage: Component<PresenterProps> = (props) => (
  <Show when={props.window} fallback={props.children}>
    <PageWindow {...props} />
  </Show>
);

/** 在内存数据和导航中复用正式 Host，实时预览 Page 与本地 Window。 */
export const ModelPreview: Component<ActionContext> = (ctx) => {
  const query = new URLSearchParams(location.search);
  const embedded = query.get("embedded") === "1";
  const revision = query.get("revision");
  const version = query.has("version") ? Number(query.get("version")) : undefined;
  if (
    !ctx.modelId ||
    (!embedded &&
      (version === undefined ? !revision : !Number.isSafeInteger(version) || version < 1))
  )
    throw new FormworkError("PARAMS_REQUIRED", "预览需要 modelId 和审阅 revision 或发布版本");
  const modelId = ctx.modelId;
  const [schema, setSchema] = createSignal<ModelDocument>();
  const [message, setMessage] = createSignal("");
  let serialized = "";
  const acceptSchema = (input: unknown) => {
    const parsed = modelDocumentSchema.safeParse(input);
    if (!parsed.success || parsed.data.id !== modelId) {
      setMessage(
        schema() ? "Schema 暂不可预览，保留上次有效内容。" : "请补全有效的 Schema 以开始预览。",
      );
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
          event.data.modelId !== modelId ||
          typeof event.data.source !== "string"
        )
          return;
        try {
          const input: unknown = JSON.parse(event.data.source);
          acceptSchema(isObject(input) ? input.document : undefined);
        } catch {
          setMessage(
            schema() ? "JSON 编辑中，保留上次有效内容。" : "请补全有效的 JSON 以开始预览。",
          );
        }
      };
      window.addEventListener("message", receive);
      onCleanup(() => window.removeEventListener("message", receive));
      window.parent.postMessage({ type: "model-preview:ready", modelId }, location.origin);
    } else {
      void (async () => {
        try {
          const document =
            version !== undefined
              ? (await ctx.api.models.version(modelId, version, { signal: ctx.signal })).definition
                  .document
              : (await ctx.api.models.draftSchema(modelId, revision!, { signal: ctx.signal }))
                  .schema;
          if (!ctx.signal.aborted) acceptSchema(document);
        } catch (error) {
          if (!ctx.signal.aborted) setMessage(errorPayload(error).message);
        }
      })();
    }
  });
  const Preview: Component<{ schema: ModelDocument }> = (props) => {
    const pages = [list, treeList];
    const router = query.get("router") ?? "list";
    const target = { router, ...(query.has("window") ? { window: query.get("window")! } : {}) };
    const params = { ...Object.fromEntries(query), modelId };
    const navigation = createMemoryNavigation(routePath(createRoutes(pages), target, params));
    const app: FormworkDefinition = {
      ...modelDefaults,
      api: createPreviewApi(props.schema),
      pages,
      presenters: { page: PreviewPage, drawer: DrawerPresenter, modal: ModalPresenter },
    };
    return <FormworkHost app={app} navigation={navigation} />;
  };
  return (
    <div class="preview-content">
      <Show when={!embedded}>
        <p class="preview-notice">模拟数据 · 所有操作仅在当前预览中生效</p>
      </Show>
      <Show when={message()}>
        <p class="preview-status" role="status">
          {message()}
        </p>
      </Show>
      <Show
        when={schema()}
        keyed
        fallback={!message() ? <p role="status">正在准备预览…</p> : undefined}
      >
        {(document) => <Preview schema={document} />}
      </Show>
    </div>
  );
};
