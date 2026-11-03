import { createContext, createUniqueId, For, Show, useContext } from "solid-js";
import type { Component } from "solid-js";
import type { FieldContainerProps } from "formwork";
import { FieldsetCard } from "../../formwork/shell/fieldset-card";
import { DetailItem } from "./detail-item";

const FieldLabel = createContext<string>();

/** 关联最近字段容器的标签，供应用字段控件共用。 */
export function useFieldLabel() {
  return useContext(FieldLabel);
}

/** 统一字段标签与错误，结构化字段分组，多选仍使用普通表单项。 */
export const FormItem: Component<FieldContainerProps> = (props) => {
  const id = createUniqueId();
  const grouped = () =>
    props.scene !== "filter" &&
    (props.field?.format === "object" || props.field?.format === "array");
  const label = () => (
    <>
      {props.title}
      {props.required && <span class="required"> *</span>}
    </>
  );
  const content = () => (
    <>
      {props.children}
      <Show
        when={
          props.scene === "form" &&
          props.binding &&
          !props.readOnly &&
          !props.schema?.readOnly &&
          !props.binding.readOnly()
        }
      >
        <div class="actions field-value-actions">
          <Show when={!props.required && props.binding!.value() !== undefined}>
            <button
              type="button"
              class="text-button"
              disabled={props.disabled}
              onClick={() => props.binding!.set(undefined)}
            >
              删除字段值
            </button>
          </Show>
          <Show
            when={
              props.schema &&
              "type" in props.schema &&
              Array.isArray(props.schema.type) &&
              props.schema.type.includes("null") &&
              props.binding!.value() !== null
            }
          >
            <button
              type="button"
              class="text-button"
              disabled={props.disabled}
              onClick={() => props.binding!.set(null)}
            >
              设为 null
            </button>
          </Show>
        </div>
      </Show>
      <Show when={props.field?.props.help}>
        <p class="muted">{String(props.field?.props.help)}</p>
      </Show>
      <For each={props.errors}>{(error) => <p class="field-error">{error.message}</p>}</For>
    </>
  );
  return (
    <FieldLabel.Provider value={id}>
      <Show when={props.scene !== "detail"} fallback={<DetailItem {...props} labelId={id} />}>
        <Show
          when={grouped()}
          fallback={
            <div class="form-item" data-field-path={props.path}>
              <div id={id} class="field-label">
                {label()}
              </div>
              {content()}
            </div>
          }
        >
          <FieldsetCard title={label()} labelId={id} fieldPath={props.path}>
            {content()}
          </FieldsetCard>
        </Show>
      </Show>
    </FieldLabel.Provider>
  );
};

/** 为紧凑筛选值提供屏幕阅读器标签和就近显示的校验错误。 */
export const FilterItem: Component<FieldContainerProps> = (props) => {
  const id = createUniqueId();
  return (
    <FieldLabel.Provider value={id}>
      <div class="form-item" data-field-path={props.path}>
        <span id={id} class="sr-only">
          {props.title}
        </span>
        {props.children}
        <For each={props.errors}>{(error) => <p class="field-error">{error.message}</p>}</For>
      </div>
    </FieldLabel.Provider>
  );
};
