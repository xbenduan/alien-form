import { onCleanup, Show } from "solid-js";
import type { Component } from "solid-js";
import type { PageContext } from "formwork";
import { ModelList } from "./model-list";
import { ModelDetail } from "./model-detail";

/** 通过 query 选择模型；切换模型时销毁旧草稿与请求。 */
export const Models: Component<PageContext> = (ctx) => (
  <Show when={ctx.query().get("modelId")} keyed fallback={<ModelList {...ctx} />}>
    {(modelId) => {
      const abort = new AbortController();
      onCleanup(() => abort.abort());
      return (
        <ModelDetail
          {...ctx}
          modelId={modelId}
          signal={AbortSignal.any([ctx.signal, abort.signal])}
        />
      );
    }}
  </Show>
);
