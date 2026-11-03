import { For, Show } from "solid-js";
import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { FieldProps } from "formwork";
import { isObject, schemaType } from "formwork/model";
import { DetailCell, valueText } from "./display";
import { Message } from "../ui/message";

/** 编辑真实对象子字段，表格使用详情入口，未填写与 null 保持独立。 */
export const ObjectFields: Component<FieldProps> = (props) => (
  <Show when={props.scene !== "table"} fallback={<DetailCell {...props} />}>
    <Show
      when={isObject(props.value) || (!props.readOnly && props.value === undefined)}
      fallback={<span class="muted">{valueText(props.value)}</span>}
    >
      <div class="field-grid object-fields">{props.children}</div>
    </Show>
    <Show when={!props.readOnly && props.value === null}>
      <button
        class="button secondary"
        type="button"
        disabled={props.disabled}
        onClick={() => props.onChange({})}
      >
        填写对象
      </button>
    </Show>
  </Show>
);

/** 通过稳定 ArrayHandle 编辑明细，在 detail 直接递归原始值且不创建 scope。 */
export const ArrayFields: Component<FieldProps> = (props) => {
  const add = () => {
    try {
      const schema = "items" in props.schema ? props.schema.items : undefined;
      const type = schema ? schemaType(schema) : undefined;
      props.array!.insert(
        props.array!.items().length,
        schema?.default ??
          (type === "string"
            ? ""
            : type === "number" || type === "integer"
              ? 0
              : type === "boolean"
                ? false
                : type === "null"
                  ? null
                  : undefined),
      );
    } catch (error) {
      Message.error(error);
    }
  };
  return (
    <Show when={props.scene !== "table"} fallback={<DetailCell {...props} />}>
      <div class="array-fields">
        <Show
          when={!props.readOnly}
          fallback={
            <Show
              when={Array.isArray(props.value)}
              fallback={<span>{valueText(props.value)}</span>}
            >
              <For each={Array.isArray(props.value) ? props.value : []}>
                {(value, index) => (
                  <div class="array-item">
                    <div class="array-item-header">第 {index() + 1} 项</div>
                    <div class="array-item-body">
                      <Dynamic component={props.ValueItem} value={value} />
                    </div>
                  </div>
                )}
              </For>
              <Show when={Array.isArray(props.value) && props.value.length === 0}>
                <p class="field-empty">[]</p>
              </Show>
            </Show>
          }
        >
          <For each={props.array?.items()}>
            {(item, index) => (
              <div class="array-item" data-item-key={item.key}>
                <div class="array-item-header">
                  <span>第 {index() + 1} 项</span>
                  <div class="actions">
                    <button
                      type="button"
                      class="text-button"
                      disabled={props.disabled || index() === 0}
                      onClick={() => props.array!.move(item.key, index() - 1)}
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      class="text-button"
                      disabled={props.disabled || index() === props.array!.items().length - 1}
                      onClick={() => props.array!.move(item.key, index() + 1)}
                    >
                      下移
                    </button>
                    <button
                      type="button"
                      class="text-button danger"
                      disabled={props.disabled}
                      onClick={() => props.array!.remove(item.key)}
                    >
                      删除明细
                    </button>
                  </div>
                </div>
                <div class="array-item-body">
                  <Dynamic component={props.Item} scope={item.scope} />
                </div>
              </div>
            )}
          </For>
          <button type="button" class="button secondary" disabled={props.disabled} onClick={add}>
            添加明细
          </button>
        </Show>
      </div>
    </Show>
  );
};
