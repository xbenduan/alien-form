import { Show } from "solid-js";
import type { Component } from "solid-js";
import type { FieldProps } from "formwork";
import { schemaType } from "formwork/model";
import { useFieldLabel } from "./field-container";
import { valueText } from "./display";
import { Select } from "./select";

type TextProps = FieldProps & {
  placeholder?: string;
  maxWidth?: number;
  maxLines?: number;
  minHeight?: number;
};

/** 按场景展示字符串摘要或编辑原始文本，保留空字符串。 */
export const Input: Component<TextProps> = (props) => (
  <Show
    when={!props.readOnly}
    fallback={
      <span
        class="value-text"
        title={valueText(props.value)}
        style={{
          "max-width": props.maxWidth ? `${props.maxWidth}px` : undefined,
          "-webkit-line-clamp": props.maxLines ?? 2,
        }}
      >
        {valueText(props.value)}
      </span>
    }
  >
    <Show when={!props.multiple} fallback={<Select {...props} />}>
      <input
        class="control"
        type="text"
        placeholder={props.placeholder}
        aria-labelledby={useFieldLabel()}
        aria-invalid={props.errors.length > 0}
        value={typeof props.value === "string" ? props.value : ""}
        disabled={props.disabled}
        onInput={(event) => props.onChange(event.currentTarget.value)}
      />
    </Show>
  </Show>
);

/** 为长字符串提供多行编辑，filter 使用单行输入、table 使用摘要。 */
export const Text: Component<TextProps> = (props) => (
  <Show when={props.scene !== "filter" && props.scene !== "table"} fallback={<Input {...props} />}>
    <Show when={!props.readOnly} fallback={<div class="rich-text">{valueText(props.value)}</div>}>
      <textarea
        class="control rich-editor"
        placeholder={props.placeholder}
        aria-labelledby={useFieldLabel()}
        aria-invalid={props.errors.length > 0}
        style={{ "min-height": `${props.minHeight ?? 120}px` }}
        value={typeof props.value === "string" ? props.value : ""}
        disabled={props.disabled}
        onInput={(event) => props.onChange(event.currentTarget.value)}
      />
    </Show>
  </Show>
);

/** 编辑有限数值，between 使用两个有序端点，in 使用原始数值多选。 */
export const NumberInput: Component<FieldProps & { placeholder?: string }> = (props) => (
  <Show when={!props.readOnly} fallback={<span>{valueText(props.value)}</span>}>
    <Show
      when={props.operator !== "between"}
      fallback={
        <div class="range-input">
          {[0, 1].map((index) => (
            <input
              class="control"
              type="number"
              step="any"
              aria-label={index === 0 ? "范围起点" : "范围终点"}
              disabled={props.disabled}
              aria-invalid={props.errors.length > 0}
              value={
                Array.isArray(props.value) && typeof props.value[index] === "number"
                  ? Number(props.value[index])
                  : ""
              }
              onInput={(event) => {
                const previous = Array.isArray(props.value) ? [...props.value] : [];
                const text = event.currentTarget.value;
                if (text === "") {
                  props.onChange(undefined);
                  return;
                }
                const number = Number(text);
                if (!Number.isFinite(number)) return;
                previous[index] = number;
                if (previous[0] === undefined) previous[0] = number;
                props.onChange(previous);
              }}
            />
          ))}
        </div>
      }
    >
      <Show when={!props.multiple} fallback={<Select {...props} />}>
        <input
          class="control"
          type="number"
          placeholder={props.placeholder}
          aria-labelledby={useFieldLabel()}
          aria-invalid={props.errors.length > 0}
          step={schemaType(props.schema) === "integer" ? "1" : "any"}
          value={typeof props.value === "number" ? props.value : ""}
          disabled={props.disabled}
          onInput={(event) => {
            const text = event.currentTarget.value;
            if (text === "") props.onChange(undefined);
            else if (Number.isFinite(Number(text))) props.onChange(Number(text));
          }}
        />
      </Show>
    </Show>
  </Show>
);

/** 以 Select 保留布尔值的未填写、false 和 true 三种状态。 */
export const BooleanField: Component<FieldProps> = (props) => <Select {...props} />;

/** 展示 null 字段，编辑时允许明确设置 null。 */
export const NullValue: Component<FieldProps> = (props) => (
  <Show when={!props.readOnly} fallback={<span class="muted">{valueText(props.value)}</span>}>
    <button
      class="button secondary"
      type="button"
      disabled={props.disabled}
      onClick={() => props.onChange(null)}
    >
      设为 null
    </button>
  </Show>
);
