import { createContext, createUniqueId, For, useContext } from "solid-js";
import type { Component } from "solid-js";
import type { FieldContainerProps } from "formwork";

const FieldLabel = createContext<string>();
const CompactCell = createContext(false);
/** 关联最近字段容器的标签，供默认与私域控件共用。 */
export function useFieldLabel() {
  return useContext(FieldLabel);
}
/** 识别表格中的紧凑只读字段，以摘要替代嵌套编辑布局。 */
export function useCompactCell() {
  return useContext(CompactCell);
}
/** 为表单字段呈现标签、必填标记和定位错误。 */
export const FormItem: Component<FieldContainerProps> = (props) => {
  const id = createUniqueId();
  return (
    <FieldLabel.Provider value={id}>
      <div class="form-item" data-field-path={props.path}>
        <div id={id} class="field-label">
          {props.title}
          {props.required && <span class="required"> *</span>}
        </div>
        {props.children}
        <For each={props.errors}>
          {(error) => (
            <p class="field-error" role="alert">
              {error.message}
            </p>
          )}
        </For>
      </div>
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
/** 以同一标签契约呈现只读详情。 */
export const DetailItem: Component<FieldContainerProps> = (props) => (
  <FormItem {...props} required={false} />
);
