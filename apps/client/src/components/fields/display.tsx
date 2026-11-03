import { createSignal, Show } from "solid-js";
import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { FieldProps, JsonValue } from "formwork";
import { Modal } from "../ui/window";
import { Icon } from "../../formwork/shell/icons";

/** 保留缺失、null、空字符串和其他原子值的展示差异。 */
export function valueText(value: JsonValue | undefined): string {
  return value === undefined
    ? "—"
    : value === null
      ? "null"
      : value === ""
        ? '""'
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
}

/** 在表格中提供复杂字段详情入口，详情递归复用同一字段描述。 */
export const DetailCell: Component<FieldProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  let trigger: HTMLButtonElement | undefined;
  const title = () => props.field.schema.title ?? props.field.path.slice(1);
  return (
    <>
      <div class="complex-cell">
        <span class="complex-summary">
          {props.value === undefined || props.value === null
            ? valueText(props.value)
            : Array.isArray(props.value)
              ? `共 ${props.value.length} 项`
              : `共 ${Object.keys(props.value as object).length} 项`}
        </span>
        <button
          ref={(element) => {
            trigger = element;
          }}
          class="text-button"
          type="button"
          aria-haspopup="dialog"
          aria-label={`查看${title()}详情`}
          onClick={() => setOpen(true)}
        >
          <Icon name="content" />
          详情
        </button>
      </div>
      <Show when={open()}>
        <Modal open label={`${title()}详情`} onClose={() => setOpen(false)} returnFocus={trigger}>
          <div class="record-detail field-detail">
            <h1>{title()}详情</h1>
            <div class="detail-fields">
              <Dynamic component={props.Detail} />
            </div>
          </div>
        </Modal>
      </Show>
    </>
  );
};
