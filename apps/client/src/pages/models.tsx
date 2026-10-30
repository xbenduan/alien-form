import { Show } from "solid-js";
import type { Component } from "solid-js";
import type { ActionContext } from "formwork";
import { ModelList } from "./model-list";
import { ModelDetail } from "./model-detail";

/** 按路由中的模型身份显示目录或 Schema 详情。 */
export const Models: Component<ActionContext> = (ctx) => (
  <Show when={ctx.domain} fallback={<ModelList {...ctx} />}>
    <ModelDetail {...ctx} />
  </Show>
);
