import type { Component } from "solid-js";
import type { WindowContext } from "formwork";
import { DetailItem } from "../../../formwork/field-container";

/** 展示 getValue 已加载的完整记录，使用 Window 的只读 scope。 */
export const RecordDetail: Component<WindowContext> = (ctx) => {
  const Render = ctx.Render;
  return (
    <div class="record-detail">
      <div class="record-heading"><h1 tabindex="-1">{ctx.schema.title}详情</h1></div>
      <div class="detail-fields"><Render fieldContainer={DetailItem} /></div>
    </div>
  );
};
