import type { Component } from "solid-js";
import type { WindowContext } from "formwork";
import { DetailItem } from "../../../formwork/field-container";
import { RecordHeading } from "../../../formwork/shell/page-window";

/** 展示 getValue 已加载的完整记录，使用 Window 的只读 scope。 */
export const RecordDetail: Component<WindowContext> = (ctx) => {
  const Render = ctx.Render;
  return (
    <div class="record-detail">
      <RecordHeading title={`${ctx.schema.title}详情`} section="记录信息" readOnly />
      <div class="detail-fields">
        <Render fieldContainer={DetailItem} />
      </div>
    </div>
  );
};
