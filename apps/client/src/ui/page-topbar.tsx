import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import { Portal } from "solid-js/web";

type TopbarSlots = {
  title: HTMLElement;
  actions: HTMLElement;
  active: () => void;
  inactive: () => void;
};
const [slots, setSlots] = createSignal<TopbarSlots>();

/** 注册当前 shell 的标题与按钮插槽；返回只清理本次注册的卸载函数。 */
export function registerTopbar(value: TopbarSlots): () => void {
  setSlots(value);
  return () => {
    if (slots() === value) setSlots(undefined);
  };
}

/** 将页面标题和操作挂到统一顶栏；独立预览页面使用自己的精简顶栏。 */
export const PageTopbar: Component<{ title: JSX.Element; actions?: JSX.Element }> = (props) => {
  createEffect(() => {
    const target = slots();
    target?.active();
    onCleanup(() => target?.inactive());
  });
  return (
    <Show
      when={slots()}
      fallback={
        <header class="topbar embedded-topbar">
          <div class="page-title">{props.title}</div>
          <div class="topbar-actions">{props.actions}</div>
        </header>
      }
    >
      {(target) => (
        <>
          <Portal mount={target().title}>{props.title}</Portal>
          <Portal mount={target().actions}>{props.actions}</Portal>
        </>
      )}
    </Show>
  );
};
