import type { FieldProps } from "formwork";
import type { Component } from "solid-js";
import { Show } from "solid-js";
import { useFieldLabel } from "../../../formwork/field-container";

/** 编辑字符串正文，详情中保留原始换行。 */
export const RichText: Component<FieldProps> = (props) => (
  <Show when={!props.readOnly} fallback={<div class="rich-text">{String(props.value ?? "")}</div>}>
    <textarea class="control rich-editor" aria-labelledby={useFieldLabel()}
      value={String(props.value ?? "")} disabled={props.disabled}
      onInput={(event) => props.onChange(event.currentTarget.value)} />
  </Show>
);
