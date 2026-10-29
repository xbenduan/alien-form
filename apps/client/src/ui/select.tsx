import { Popover } from "@kobalte/core/popover";
import { createEffect, createMemo, createSignal, createUniqueId, For, Show } from "solid-js";
import type { Component } from "solid-js";
import { Icon } from "./icons";

/** 描述自绘下拉框中的可选值与展示文案。 */
export type SelectOption = { value: string; label: string; disabled?: boolean };

type SelectProps = {
  options: readonly SelectOption[];
  value?: string;
  onChange: (value: string | undefined) => void;
  label?: string;
  labelledBy?: string;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  class?: string;
};

/** 呈现主题一致的自绘 Select，支持键盘选择、输入定位和浮层避让。
 * `clearable` 会添加一个返回 undefined 的选项，字符串值（包括 "0"）保持不变。
 */
export const SelectControl: Component<SelectProps> = (props) => {
  const id = createUniqueId();
  const [open, setOpen] = createSignal(false);
  const [highlighted, setHighlighted] = createSignal(-1);
  let trigger: HTMLButtonElement | undefined;
  let menu: HTMLDivElement | undefined;
  let restoreFocus = false;
  let search = "";
  let searchedAt = 0;
  const placeholder = () => props.placeholder ?? "未选择";
  const items = createMemo(() => [
    ...(props.clearable ? [{ value: undefined, label: placeholder(), disabled: false }] : []),
    ...props.options,
  ]);
  const selected = () => items().findIndex((option) => option.value === props.value);
  const enabled = () =>
    items()
      .map((option, index) => (option.disabled ? -1 : index))
      .filter((index) => index >= 0);
  const changeOpen = (next: boolean) => {
    if (props.disabled && next) return;
    if (next) {
      search = "";
      setHighlighted(
        selected() >= 0 && !items()[selected()]?.disabled ? selected() : (enabled()[0] ?? -1),
      );
    }
    setOpen(next);
  };
  const choose = (index: number) => {
    const option = items()[index];
    if (!option || option.disabled) return;
    restoreFocus = true;
    props.onChange(option.value);
    changeOpen(false);
  };
  const move = (direction: 1 | -1) => {
    const available = enabled();
    if (!available.length) return;
    const current = available.indexOf(highlighted());
    setHighlighted(available[(current + direction + available.length) % available.length]!);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && open()) {
      event.preventDefault();
      event.stopPropagation();
      restoreFocus = true;
      changeOpen(false);
    } else if (event.key === "Tab") {
      changeOpen(false);
    } else if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      const wasOpen = open();
      if (!wasOpen) changeOpen(true);
      if (event.key === "ArrowDown" && wasOpen) move(1);
      if (event.key === "ArrowUp" && wasOpen) move(-1);
      if (event.key === "Home") setHighlighted(enabled()[0] ?? -1);
      if (event.key === "End" || (event.key === "ArrowUp" && !wasOpen))
        setHighlighted(enabled().at(-1) ?? -1);
      if ((event.key === "Enter" || event.key === " ") && wasOpen) choose(highlighted());
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const character = event.key.toLocaleLowerCase();
      search = now - searchedAt > 700 || search === character ? character : search + character;
      searchedAt = now;
      const options = items();
      const start = open() ? highlighted() : selected();
      for (let offset = 1; offset <= options.length; offset++) {
        const index = (start + offset + options.length) % options.length;
        const option = options[index]!;
        if (!option.disabled && option.label.toLocaleLowerCase().startsWith(search)) {
          if (open()) setHighlighted(index);
          else props.onChange(option.value);
          break;
        }
      }
    }
  };
  createEffect(() => {
    if (!open()) return;
    const index = highlighted();
    queueMicrotask(() => {
      if (open())
        menu
          ?.querySelector<HTMLElement>(`[data-option-index="${index}"]`)
          ?.scrollIntoView({ block: "nearest" });
    });
  });
  createEffect(() => {
    if (props.disabled && open()) changeOpen(false);
  });
  return (
    <div class={`custom-select ${props.class ?? ""}`}>
      <Popover
        open={open()}
        onOpenChange={changeOpen}
        placement="bottom-start"
        sameWidth
        gutter={4}
        fitViewport
        overflowPadding={8}
        modal={false}
      >
        <Popover.Trigger
          ref={(element) => {
            trigger = element;
          }}
          type="button"
          class="select-trigger"
          role="combobox"
          aria-haspopup="listbox"
          aria-controls={open() ? `${id}-listbox` : undefined}
          aria-expanded={open()}
          aria-activedescendant={
            open() && highlighted() >= 0 ? `${id}-option-${highlighted()}` : undefined
          }
          aria-label={props.label}
          aria-labelledby={props.labelledBy}
          aria-invalid={props.invalid}
          disabled={props.disabled}
          onKeyDown={onKeyDown}
        >
          <span classList={{ "select-placeholder": props.value === undefined }}>
            {props.options.find((option) => option.value === props.value)?.label ?? placeholder()}
          </span>
          <Icon name="chevron" class="select-chevron" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            ref={(element) => {
              menu = element;
            }}
            id={`${id}-listbox`}
            role="listbox"
            aria-label={props.label}
            aria-labelledby={props.labelledBy}
            class="select-menu"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (restoreFocus) trigger?.focus();
              restoreFocus = false;
            }}
          >
            <For each={items()}>
              {(option, index) => (
                <div
                  id={`${id}-option-${index()}`}
                  role="option"
                  aria-selected={option.value === props.value}
                  aria-disabled={option.disabled || undefined}
                  class="select-option"
                  data-option-index={index()}
                  data-highlighted={highlighted() === index() ? "" : undefined}
                  onPointerDown={(event) => event.preventDefault()}
                  onPointerMove={() => {
                    if (!option.disabled) setHighlighted(index());
                  }}
                  onClick={() => choose(index())}
                >
                  <span>{option.label}</span>
                  <Show when={option.value === props.value}>
                    <Icon name="check" />
                  </Show>
                </div>
              )}
            </For>
            <Show when={items().length === 0}>
              <p class="select-empty">暂无选项</p>
            </Show>
          </Popover.Content>
        </Popover.Portal>
      </Popover>
    </div>
  );
};
