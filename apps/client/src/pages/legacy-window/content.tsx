import { Navigate } from "@solidjs/router";
import type { Component } from "solid-js";
import type { ActionContext } from "formwork";

/** 将旧全局 Window URL 重定向到列表所属 Window，保留搜索参数。 */
export const LegacyWindow: Component<ActionContext> = (ctx) => {
  const name = ctx.router.replace("legacy-", "");
  const target = `/list/${encodeURIComponent(ctx.modelId!)}/${name}${
    ctx.params.id === undefined ? "" : `/${encodeURIComponent(ctx.params.id)}`
  }${location.search}`;
  return <Navigate href={target} />;
};
