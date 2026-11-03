import { Popover } from "@kobalte/core/popover";
import { createEffect, createSignal, createUniqueId, For, Show } from "solid-js";
import type { Component } from "solid-js";
import { Icon } from "../../formwork/shell/icons";

type Choice = { key: string; label: string };

/** 提供可搜索、可创建、多选的下拉交互，原始业务值由字段 Adapter 管理。 */
export const ChoiceControl: Component<{
  options: readonly Choice[];
  selected: readonly Choice[];
  multiple: boolean;
  placeholder?: string;
  labelledBy?: string;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  loading?: boolean;
  search: string;
  onSearch: (value: string) => void;
  onChoose: (key: string) => void;
  onClear: () => void;
  onCreate?: () => void;
  onOpen?: () => void;
}> = (props) => {
  const id = createUniqueId();
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(0);
  let trigger: HTMLButtonElement | undefined;
  let search: HTMLInputElement | undefined;
  const choose = (index: number) => {
    const option = props.options[index];
    if (!option || props.disabled) return;
    props.onChoose(option.key);
    if (!props.multiple) setOpen(false);
  };
  createEffect(() => {
    setActive(props.options.length ? 0 : -1);
  });
  createEffect(() => {
    if (props.disabled) setOpen(false);
  });
  const keyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) =>
        Math.max(
          0,
          Math.min(props.options.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)),
        ),
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (props.onCreate && !props.options.length) props.onCreate();
      else choose(active());
    }
  };
  return (
    <div class="custom-select">
      <Popover
        open={open()}
        onOpenChange={(next) => {
          if (next && props.disabled) return;
          setOpen(next);
          if (next) {
            props.onOpen?.();
            props.onSearch("");
          }
        }}
        placement="bottom-start"
        sameWidth
        gutter={4}
        fitViewport
        modal
      >
        <Popover.Trigger
          ref={(element) => {
            trigger = element;
          }}
          class="select-trigger"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open()}
          aria-controls={`${id}-list`}
          aria-labelledby={props.labelledBy}
          aria-invalid={props.invalid}
          disabled={props.disabled}
          type="button"
        >
          <span classList={{ "select-placeholder": !props.selected.length }}>
            {props.selected.length
              ? props.selected.map((item) => item.label).join("、")
              : (props.placeholder ?? "请选择")}
          </span>
          <Icon name="chevron" />
        </Popover.Trigger>
        <Popover.Portal mount={trigger?.closest<HTMLElement>("[data-formwork-root]") ?? undefined}>
          <Popover.Content
            class="select-menu"
            role="presentation"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              search?.focus();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              trigger?.focus();
            }}
          >
            <input
              ref={(element) => {
                search = element;
              }}
              type="search"
              class="control select-search"
              aria-label="搜索选项"
              value={props.search}
              onInput={(event) => props.onSearch(event.currentTarget.value)}
              onKeyDown={keyDown}
              role="combobox"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-activedescendant={props.options[active()] ? `${id}-${active()}` : undefined}
            />
            <div
              id={`${id}-list`}
              role="listbox"
              aria-labelledby={props.labelledBy}
              aria-multiselectable={props.multiple}
              aria-busy={props.loading}
            >
              <For each={props.options}>
                {(option, index) => (
                  <div
                    id={`${id}-${index()}`}
                    role="option"
                    class="select-option"
                    aria-selected={props.selected.some((item) => item.key === option.key)}
                    data-highlighted={index() === active() ? "" : undefined}
                    onPointerDown={(event) => event.preventDefault()}
                    onPointerMove={() => setActive(index())}
                    onClick={() => choose(index())}
                  >
                    <span>{option.label}</span>
                    <Show when={props.selected.some((item) => item.key === option.key)}>
                      <Icon name="check" />
                    </Show>
                  </div>
                )}
              </For>
            </div>
            <Show when={props.loading}>
              <p class="select-empty" role="status">
                正在加载…
              </p>
            </Show>
            <Show when={!props.loading && !props.options.length && !props.onCreate}>
              <p class="select-empty">暂无选项</p>
            </Show>
            <Show when={props.onCreate}>
              <button
                class="text-button choice-action"
                type="button"
                onClick={() => props.onCreate?.()}
              >
                添加“{props.search}”
              </button>
            </Show>
            <Show when={props.clearable}>
              <button
                class="text-button choice-action"
                type="button"
                onClick={() => {
                  props.onClear();
                  setOpen(false);
                }}
              >
                清除值
              </button>
            </Show>
          </Popover.Content>
        </Popover.Portal>
      </Popover>
    </div>
  );
};
