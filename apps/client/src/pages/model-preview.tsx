import { createSignal, Show } from "solid-js";
import type { Component } from "solid-js";
import { createInstance, FormworkError } from "formwork";
import type { ActionContext, FormworkDefinition } from "formwork";
import type { FormworkApi } from "formwork/model";
import { components } from "../components";
import * as recordFns from "../fn/records";
import { add, detail, edit, list } from "../schema-pages";
import { FormItem } from "../ui/field-container";

/** 以指定审阅 revision 加载管理草稿，复用 Page 与 Domain 并禁止业务写入。 */
export const ModelPreview: Component<ActionContext> = (ctx) => {
  const query = new URLSearchParams(location.search);
  const revision = query.get("revision");
  const initialRouter = query.get("router") ?? "list";
  if (!ctx.domain || !revision)
    throw new FormworkError("PARAMS_REQUIRED", "预览需要 domain 和审阅 revision");
  const domain = ctx.domain;
  const [target, setTarget] = createSignal({
    router: initialRouter,
    params: { domain, id: query.get("id") ?? undefined },
  });
  const [message, setMessage] = createSignal("");
  const denied = () =>
    Promise.reject(
      new FormworkError("PREVIEW_READ_ONLY", "预览不保存业务数据，请在普通业务页面操作。"),
    );
  let published = false;
  const previewApi: FormworkApi = {
    ...ctx.api,
    request: (path, method, body, options) =>
      path.startsWith("/records/") && method && method !== "GET" && !path.endsWith("/query")
        ? denied()
        : ctx.api.request(path, method, body, options),
    records: {
      ...ctx.api.records,
      query: (...args) =>
        published ? ctx.api.records.query(...args) : Promise.resolve({ list: [], total: 0 }),
      read: (...args) =>
        published
          ? ctx.api.records.read(...args)
          : Promise.reject(
              new FormworkError(
                "PARAMS_REQUIRED",
                "未发布模型没有可加载的实际记录，请选择新建预览。",
              ),
            ),
      create: denied,
      update: denied,
      delete: denied,
      command: denied,
    },
  };
  const Preview: Component<{ selection: ReturnType<typeof target> }> = (props) => {
    const { router, params } = props.selection;
    const original = [list, add, edit, detail].find((page) => page.router === router);
    if (!original) throw new FormworkError("UNKNOWN_ROUTER", `未知预览 router ${router}`);
    if (original.render) throw new FormworkError("INVALID_DEFINITION", "预览页面必须加载 schema");
    if (["edit", "detail"].includes(router) && !params.id)
      throw new FormworkError("PARAMS_REQUIRED", "编辑和详情预览需要记录 ID");
    const app: FormworkDefinition = {
      api: previewApi,
      components,
      fn: recordFns,
      fieldContainer: FormItem,
      pages: [],
      presenters: { page: (props) => props.children },
    };
    const instance = createInstance(
      app,
      {
        ...original,
        getSchema: async (load) => {
          const snapshot = await ctx.api.models.draftSchema(domain, revision, {
            signal: load.signal,
          });
          published = snapshot.baseVersion !== null;
          return snapshot.schema;
        },
      },
      params,
      {
        navigate: (next, values) => setTarget({ router: next, params: { domain, id: values?.id } }),
        open: async (next, values) => {
          setTarget({ router: next, params: { domain, id: values?.id } });
          return { status: "cancelled" };
        },
        complete: () => setMessage("预览不会提交业务数据。"),
      },
    );
    return instance.output;
  };
  return (
    <div class="preview-content">
      <p class="preview-notice">管理预览 · {revision.slice(0, 8)} · 可编辑表单，业务写入已禁用</p>
      <Show when={message()}>
        <p role="status">{message()}</p>
      </Show>
      <Show when={target()} keyed>
        {(selection) => <Preview selection={selection} />}
      </Show>
    </div>
  );
};
