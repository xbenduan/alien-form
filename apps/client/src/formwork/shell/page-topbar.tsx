import { createContext, createEffect, onCleanup, Show, useContext } from "solid-js";
import type { Accessor, Component, JSX } from "solid-js";
import { Portal } from "solid-js/web";

/** 保存当前应用外壳的标题和按钮插槽。 */
export type TopbarSlots = {
  title: HTMLElement;
  actions: HTMLElement;
  active: () => void;
  inactive: () => void;
};
/** 将顶栏限定在当前应用外壳，记录操作页复用同一插槽。 */
export const TopbarContext = createContext<Accessor<TopbarSlots | undefined>>();

/** 将页面标题和操作挂到统一顶栏；独立预览页面使用自己的精简顶栏。 */
export const PageTopbar: Component<{ title: JSX.Element; actions?: JSX.Element }> = (props) => {
  const slots = useContext(TopbarContext) ?? (() => undefined);
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
