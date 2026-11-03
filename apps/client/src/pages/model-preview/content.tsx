import { createSignal, onCleanup, onMount, Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import { createMemoryHistory } from "@solidjs/router";
import { defineFormwork, Formwork, FormworkError } from "formwork";
import type { PageContext, ModelDocument } from "formwork";
import type { RecordSnapshot } from "formwork/data";
import {
  errorPayload,
  isObject,
  modelDocumentSchema,
  modelIssues,
  identityFields,
} from "formwork/model";
import { cmsContract } from "../../../../../packages/domain-contracts";
import { domains } from "../../domains";
import { components } from "../../formwork/components";
import { ui } from "../../formwork/ui";
import { api } from "../../formwork/api";
import { createPreviewApi } from "./api";

// 保留弹层外的稳定节点，查询 Suspense 切换时仍能正确恢复外部可访问性状态。
const PreviewShell: Component<{ children?: JSX.Element }> = (props) => (
  <div class="preview-surface">{props.children}</div>
);

/** 在独立内存路由和数据中复用正式列表，实时预览当前有效 Schema。 */
export const ModelPreview: Component<PageContext> = (ctx) => {
  const query = ctx.query();
  const embedded = query.get("embedded") === "1";
  const revision = query.get("revision");
  const version = query.has("version") ? Number(query.get("version")) : undefined;
  if (
    !query.get("modelId") ||
    (!embedded &&
      (version === undefined ? !revision : !Number.isSafeInteger(version) || version < 1))
  )
    throw new FormworkError("PARAMS_REQUIRED", "预览需要 modelId 和审阅 revision 或发布版本");
  const modelId = query.get("modelId")!;
  const router = query.get("router") ?? "list";
  if (!domains.some((domain) => domain.router === router))
    throw new FormworkError("UNKNOWN_ROUTER", "预览 Domain 不存在");
  const records = new Map<string, RecordSnapshot>();
  const [schema, setSchema] = createSignal<ModelDocument>();
  const [message, setMessage] = createSignal("");
  let serialized = "";
  const acceptSchema = (input: unknown) => {
    const parsed = modelDocumentSchema.safeParse(input);
    if (
      !parsed.success ||
      parsed.data.id !== modelId ||
      modelIssues(parsed.data, cmsContract).length
    ) {
      setMessage(
        schema() ? "Schema 暂不可预览，保留上次有效内容。" : "请补全有效的 Schema 以开始预览。",
      );
      return;
    }
    const next = JSON.stringify(parsed.data);
    if (next !== serialized) {
      serialized = next;
      setSchema({ ...parsed.data, data: { ...identityFields, ...parsed.data.data } });
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
          if (isObject(input)) {
            const { backend: _backend, ...schema } = input;
            acceptSchema(schema);
          } else acceptSchema(input);
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
          const definition =
            version !== undefined
              ? (await api.models.version(modelId, version, { signal: ctx.signal })).definition
              : (await api.models.draftSchema(modelId, revision!, { signal: ctx.signal })).schema;
          if (!ctx.signal.aborted) {
            const { backend: _backend, ...document } = definition as ModelDocument & {
              backend?: unknown;
            };
            acceptSchema(document);
          }
        } catch (error) {
          if (!ctx.signal.aborted) setMessage(errorPayload(error).message);
        }
      })();
    }
  });
  const Preview: Component<{ schema: ModelDocument }> = (props) => {
    const history = createMemoryHistory();
    history.set({ value: `/${router}/${encodeURIComponent(modelId)}`, replace: true });
    const app = defineFormwork({
      ...cmsContract,
      apis: createPreviewApi(props.schema, records),
      components: { ...components, PreviewShell },
      ui: { ...ui, shell: "PreviewShell" },
      domains,
      pages: [],
    });
    return <Formwork app={app} memoryHistory={history} class="root-formwork" />;
  };
  return (
    <div class="preview-content">
      <Show when={!embedded}>
        <p class="preview-notice">本地预览 · 数据仅保存在当前预览内存中</p>
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
