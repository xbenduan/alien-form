import type { Component, JSX } from "solid-js";

/**
 * 用虚线 fieldset 和嵌在边框中的 legend 呈现对象与数组分组。
 * @param props.labelId 用作 legend 的 id，关联分组和字段控件的可访问名称。
 */
export const FieldsetCard: Component<{
  title: JSX.Element;
  labelId: string;
  fieldPath: string;
  children?: JSX.Element;
}> = (props) => (
  <fieldset
    class="form-item fieldset-card"
    data-field-path={props.fieldPath}
    aria-labelledby={props.labelId}
  >
    <legend id={props.labelId} class="fieldset-legend">
      {props.title}
    </legend>
    <div class="fieldset-body">{props.children}</div>
  </fieldset>
);
