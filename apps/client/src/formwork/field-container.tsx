import { createContext, createUniqueId, For, Show, useContext } from "solid-js";
import type { Component } from "solid-js";
import type { FieldContainerProps } from "formwork";
import { FieldsetCard } from "./shell/fieldset-card";

const FieldLabel = createContext<string>();
const CompactCell = createContext(false);
/** 关联最近字段容器的标签，供框架与 Domain 控件共用。 */
export function useFieldLabel() {
  return useContext(FieldLabel);
}
/** 识别表格中的紧凑只读字段，以摘要替代嵌套编辑布局。 */
export function useCompactCell() {
  return useContext(CompactCell);
}
/** 为普通字段呈现标签，将对象与数组分组呈现为 fieldset 卡片。 */
export const FormItem: Component<FieldContainerProps> = (props) => {
  const id = createUniqueId();
  const grouped = () => props.schema && ("properties" in props.schema || "items" in props.schema);
  const label = () => (
    <>
      {props.title}
      {props.required && <span class="required"> *</span>}
    </>
  );
  const content = () => (
    <>
      {props.children}
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
/** 将共享字段渲染成紧凑筛选项。 */
export const FilterItem: Component<FieldContainerProps> = (props) => <FormItem {...props} />;
/** 在表格中保留字段绑定，不重复呈现表头标签。 */
export const TableCell: Component<FieldContainerProps> = (props) => (
  <CompactCell.Provider value={true}>
    {props.children}
    <For each={props.errors}>{(error) => <span class="field-error">{error.message}</span>}</For>
  </CompactCell.Provider>
);
/** 保留只读详情的字段标签，让内容垂直居中并保持左对齐。 */
export const DetailItem: Component<FieldContainerProps> = (props) => (
  <FormItem {...props} required={false}>
    <div class="detail-value">{props.children}</div>
  </FormItem>
);
