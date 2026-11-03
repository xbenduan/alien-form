import { createSignal, onCleanup, Show } from "solid-js";
import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { FieldProps, JsonValue } from "formwork";
import { Modal } from "../ui/window";
import { Icon } from "../../formwork/shell/icons";
import { Message } from "../ui/message";

const numberFormat = new Intl.NumberFormat("zh-CN", { maximumSignificantDigits: 21 });
const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** 为未填写、null、空字符串及空集合提供可区分的只读说明。 */
export const EmptyValue: Component<{ value: JsonValue | undefined }> = (props) => (
  <span class="detail-empty">
    <span aria-hidden="true">—</span>
    {props.value === undefined ? (
      "未填写"
    ) : props.value === null ? (
      <>
        空值 <code>null</code>
      </>
    ) : props.value === "" ? (
      <>
        空文本 <code>""</code>
      </>
    ) : Array.isArray(props.value) ? (
      <>
        暂无明细 <code>[]</code>
      </>
    ) : (
      <>
        暂无内容 <code>{"{}"}</code>
      </>
    )}
  </span>
);

/** 格式化详情中的数值和日期，长文本完整换行并支持复制原始值。 */
export const DetailValue: Component<{
  value: JsonValue | undefined;
  label?: string;
  multiline?: boolean;
  datetime?: boolean;
}> = (props) => {
  const [copying, setCopying] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copiedTimer));
  const empty = () => props.value === undefined || props.value === null || props.value === "";
  const date = () => {
    if (!props.datetime || typeof props.value !== "string") return undefined;
    const parsed = new Date(props.value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };
  const long = () =>
    props.multiline || (typeof props.value === "string" && props.value.length > 80);
  const copyable = () =>
    typeof props.value === "string" && props.value.length >= 24 && !props.datetime;
  return (
    <Show when={!empty()} fallback={<EmptyValue value={props.value} />}>
      <span
        class="detail-scalar"
        classList={{ "detail-text-long": long(), "detail-number": typeof props.value === "number" }}
      >
        <Show
          when={date()}
          fallback={
            <span class="detail-text">
              {typeof props.value === "number"
                ? numberFormat.format(props.value)
                : valueText(props.value)}
            </span>
          }
        >
          {(value) => (
            <time datetime={String(props.value)} title={String(props.value)}>
              {dateFormat.format(value())}
            </time>
          )}
        </Show>
        <Show when={copyable()}>
          <button
            type="button"
            class="icon-button detail-copy"
            aria-label={`复制${props.label ?? "内容"}`}
            title={copied() ? "已复制" : "复制原始内容"}
            data-copied={copied() || undefined}
            disabled={copying()}
            onClick={async () => {
              if (copying()) return;
              setCopying(true);
              try {
                await navigator.clipboard.writeText(String(props.value));
                setCopied(true);
                clearTimeout(copiedTimer);
                copiedTimer = setTimeout(() => setCopied(false), 2000);
              } catch (error) {
                Message.error(error);
              } finally {
                setCopying(false);
              }
            }}
          >
            <Icon name={copied() ? "check" : "copy"} />
            <Show when={copied()}>
              <span class="sr-only" role="status">
                已复制
              </span>
            </Show>
          </button>
        </Show>
      </span>
    </Show>
  );
};

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
            <div class="detail-fields">
              <Dynamic component={props.Detail} />
            </div>
          </div>
        </Modal>
      </Show>
    </>
  );
};
