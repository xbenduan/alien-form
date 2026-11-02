import { createContext, createUniqueId, For, Show, useContext } from "solid-js";
import type { Component } from "solid-js";
import type { FieldContainerProps, JsonValue } from "formwork";
import { FieldsetCard } from "./shell/fieldset-card";
import { Icon } from "./shell/icons";

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
const empty = (value: JsonValue | undefined) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);
const summary = (value: JsonValue | undefined) => {
  if (empty(value)) return "—";
  if (Array.isArray(value)) return `共 ${value.length} 项`;
  if (value && typeof value === "object") {
    const count = Object.values(value).filter((item) => !empty(item)).length;
    return count ? `已配置 ${count} 项` : "—";
  }
  return String(value);
};

/**
 * 在表格中呈现复杂字段摘要与详情入口，普通字段保留共享渲染。
 * @param props.onDetail 接收触发按钮，供弹层关闭后恢复焦点。
 */
export const TableCell: Component<
  FieldContainerProps & {
    value?: JsonValue;
    onDetail?: (trigger: HTMLButtonElement) => void;
  }
> = (props) => (
  <CompactCell.Provider value={true}>
    <Show
      when={
        props.onDetail && props.schema && ("properties" in props.schema || "items" in props.schema)
      }
      fallback={props.children}
    >
      <div class="complex-cell" data-field-path={props.path}>
        <span class="complex-summary">{summary(props.value)}</span>
        <button
          type="button"
          class="text-button"
          aria-label={`查看${props.title}详情`}
          aria-haspopup="dialog"
          onClick={(event) => props.onDetail?.(event.currentTarget)}
        >
          <Icon name="content" />
          详情
        </button>
      </div>
    </Show>
    <For each={props.errors}>{(error) => <span class="field-error">{error.message}</span>}</For>
  </CompactCell.Provider>
);
/** 保留只读详情的字段标签，让内容垂直居中并保持左对齐。 */
export const DetailItem: Component<FieldContainerProps> = (props) => (
  <FormItem {...props} required={false}>
    <div class="detail-value">{props.children}</div>
  </FormItem>
);
