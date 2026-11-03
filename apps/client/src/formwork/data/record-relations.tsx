import type { Component, JSX } from "solid-js";
import type { PageContext } from "formwork";
import { RelationOptions } from "../../components/fields/relation-options";

/** 把当前模型 API 和页面生命周期接入通用关系选项缓存。 */
export const RecordRelations: Component<{
  ctx: Pick<PageContext, "api" | "modelId" | "signal">;
  children?: JSX.Element;
}> = (props) => (
  <RelationOptions
    signal={props.ctx.signal}
    load={(input, signal) => props.ctx.api.records.options(props.ctx.modelId, input, { signal })}
  >
    {props.children}
  </RelationOptions>
);
