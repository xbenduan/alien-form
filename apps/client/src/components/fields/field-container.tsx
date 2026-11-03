import { createContext, createUniqueId, For, Show, useContext } from "solid-js";
import type { Component } from "solid-js";
import type { FieldContainerProps } from "formwork";
import { FieldsetCard } from "../../formwork/shell/fieldset-card";

const FieldLabel = createContext<string>();

/** 关联最近字段容器的标签，供 Framework 与 Domain 控件共用。 */
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
      <Show when={props.field?.props.help}>
        <p class="muted">{String(props.field?.props.help)}</p>
      </Show>
      <For each={props.errors}>
        {(error) => (
          <p class="field-error" role="alert">
            {error.message}
          </p>
        )}
      </For>
    </>
  );
  return (
    <FieldLabel.Provider value={id}>
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
    </FieldLabel.Provider>
  );
};

/** 为筛选保留相同的标签和错误关联。 */
export const FilterItem: Component<FieldContainerProps> = (props) => <FormItem {...props} />;
