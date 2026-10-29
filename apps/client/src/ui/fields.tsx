import { createSignal, For, Show } from "solid-js";
import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { FieldProps, JsonValue } from "formwork";
import { useFieldLabel } from "./field-container";

const text = (value: JsonValue | undefined) =>
  value === undefined
    ? "—"
    : value === null
      ? "null"
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
/** 编辑字符串，空字符串与缺失值保持独立。 */
export const Input: Component<FieldProps> = (props) => (
  <Show when={!props.readOnly} fallback={<span>{text(props.value)}</span>}>
    <input
      class="control"
      type="text"
      aria-labelledby={useFieldLabel()}
      aria-invalid={props.errors.length > 0}
      value={typeof props.value === "string" ? props.value : ""}
      disabled={props.disabled}
      onInput={(event) => props.onChange(event.currentTarget.value)}
    />
    <Show when={"type" in props.schema && Array.isArray(props.schema.type)}>
      <button class="text-button" disabled={props.disabled} onClick={() => props.onChange(null)}>
        设为 null
      </button>
    </Show>
  </Show>
);
/** 编辑数值，空输入删除可选字段，0 不视为缺失。 */
export const NumberInput: Component<FieldProps> = (props) => (
  <Show when={!props.readOnly} fallback={<span>{text(props.value)}</span>}>
    <input
      class="control"
      type="number"
      aria-labelledby={useFieldLabel()}
      aria-invalid={props.errors.length > 0}
      step={"type" in props.schema && props.schema.type === "integer" ? "1" : "any"}
      value={typeof props.value === "number" ? props.value : ""}
      disabled={props.disabled}
      onInput={(event) =>
        props.onChange(
          event.currentTarget.value === "" ? undefined : Number(event.currentTarget.value),
        )
      }
    />
  </Show>
);
/** 使用 option 索引保持 enum、boolean、null 与 undefined 的原始类型。 */
export const Select: Component<FieldProps> = (props) => {
  const options = () =>
    "enum" in props.schema && props.schema.enum
      ? props.schema.enum
      : "type" in props.schema &&
          (props.schema.type === "boolean" ||
            (Array.isArray(props.schema.type) && props.schema.type[0] === "boolean"))
        ? [true, false, ...(Array.isArray(props.schema.type) ? [null] : [])]
        : [];
  return (
    <Show when={!props.readOnly} fallback={<span>{text(props.value)}</span>}>
      <select
        class="control"
        aria-labelledby={useFieldLabel()}
        aria-invalid={props.errors.length > 0}
        disabled={props.disabled}
        value={
          props.value === undefined
            ? ""
            : String(options().findIndex((value) => value === props.value))
        }
        onChange={(event) =>
          props.onChange(
            event.currentTarget.value === ""
              ? undefined
              : (options()[Number(event.currentTarget.value)] as JsonValue),
          )
        }
      >
        <option value="">未选择</option>
        <For each={options()}>
          {(value, index) => (
            <option value={String(index())}>
              {value === true ? "是" : value === false ? "否" : text(value)}
            </option>
          )}
        </For>
      </select>
    </Show>
  );
};
/** 编辑布尔值，受控回调传递 boolean。 */
export const Switch: Component<FieldProps> = (props) => (
  <Show
    when={!props.readOnly}
    fallback={<span>{props.value === undefined ? "—" : props.value ? "是" : "否"}</span>}
  >
    <label class="switch">
      <input
        type="checkbox"
        aria-labelledby={useFieldLabel()}
        checked={props.value === true}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
      />
      <span>{props.value ? "是" : "否"}</span>
    </label>
  </Show>
);
/** 承载对象的惰性子字段，不创建额外业务值。 */
export const ObjectFields: Component<FieldProps> = (props) => (
  <div class="field-grid">{props.children}</div>
);
/** 渲染稳定身份的明细项，并通过 ArrayHandle 执行结构操作。 */
export const ArrayFields: Component<FieldProps> = (props) => {
  const [error, setError] = createSignal("");
  const add = () => {
    try {
      const schema = "items" in props.schema ? props.schema.items : undefined;
      const type =
        schema && "type" in schema
          ? Array.isArray(schema.type)
            ? schema.type[0]
            : schema.type
          : undefined;
      const value =
        schema && "type" in schema && Array.isArray(schema.type)
          ? null
          : type === "string"
            ? ""
            : type === "number" || type === "integer"
              ? 0
              : type === "boolean"
                ? false
                : type === "null"
                  ? null
                  : undefined;
      props.array!.insert(props.array!.items().length, value);
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <div class="array-fields">
      <For each={props.array?.items()}>
        {(item, index) => (
          <div class="array-item" data-item-key={item.key}>
            <div class="array-item-header">
              <span>第 {index() + 1} 项</span>
              <Show when={!props.readOnly}>
                <div class="actions">
                  <button
                    class="text-button"
                    disabled={props.disabled || index() === 0}
                    onClick={() => props.array!.move(item.key, index() - 1)}
                  >
                    上移
                  </button>
                  <button
                    class="text-button"
                    disabled={props.disabled || index() === props.array!.items().length - 1}
                    onClick={() => props.array!.move(item.key, index() + 1)}
                  >
                    下移
                  </button>
                  <button
                    class="text-button danger"
                    disabled={props.disabled}
                    onClick={() => props.array!.remove(item.key)}
                  >
                    删除明细
                  </button>
                </div>
              </Show>
            </div>
            <Dynamic component={props.Item} scope={item.scope} />
          </div>
        )}
      </For>
      <Show when={!props.readOnly}>
        <button class="button secondary" disabled={props.disabled} onClick={add}>
          添加明细
        </button>
      </Show>
      <Show when={error()}>
        <p role="alert">{error()}</p>
      </Show>
    </div>
  );
};
/** 展示 null 类型字段。 */
export const NullValue: Component<FieldProps> = () => <span class="muted">null</span>;
