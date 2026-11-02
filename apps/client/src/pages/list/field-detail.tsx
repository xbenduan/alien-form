import { Show } from "solid-js";
import type { Component } from "solid-js";
import type { JsonValue, PageContext } from "formwork";
import { readPointer } from "formwork/model";
import { DetailItem } from "../../formwork/field-container";
import { Modal } from "../../formwork/shell/window";

/**
 * 用完整记录的只读快照和原字段路径呈现行内详情，保留 Domain 与字段展示配置。
 * @param props.value 完整记录快照，供嵌套字段表达式读取同一记录的其他字段。
 */
export const FieldDetail: Component<{
  ctx: PageContext;
  field: string;
  title: string;
  value: JsonValue | undefined;
  trigger: HTMLButtonElement;
  onClose: () => void;
}> = (props) => {
  const scope = props.ctx.createScope({
    value: props.value,
    readOnly: true,
    defaults: false,
  });
  const Render = props.ctx.Render;
  const value = readPointer(props.value, props.field);
  return (
    <Modal open label={`${props.title}详情`} onClose={props.onClose} returnFocus={props.trigger}>
      <div class="record-detail field-detail">
        <div class="record-heading">
          <h1 tabindex="-1">{props.title}详情</h1>
        </div>
        <div class="detail-fields">
          <Show
            when={value !== undefined && value !== null}
            fallback={<p class="field-empty">暂无字段详情</p>}
          >
            <Render scope={scope} field={props.field} mode="form" fieldContainer={DetailItem} />
          </Show>
        </div>
      </div>
    </Modal>
  );
};
