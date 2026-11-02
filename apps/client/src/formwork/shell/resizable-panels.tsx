import { createSignal, onCleanup, onMount } from "solid-js";
import type { Component, JSX } from "solid-js";

/** 并排显示 Schema 与预览，支持指针和键盘调整，窄屏由样式切换为上下排列。 */
export const ResizablePanels: Component<{ left: JSX.Element; right: JSX.Element }> = (props) => {
  const [ratio, setRatio] = createSignal(50);
  const [minimum, setMinimum] = createSignal(0);
  const [dragging, setDragging] = createSignal(false);
  let container!: HTMLDivElement;
  let separator!: HTMLDivElement;
  let pointer: number | undefined;
  const separatorWidth = () => separator.getBoundingClientRect().width;
  const clamp = (value: number) => Math.max(minimum(), Math.min(100 - minimum(), value));
  const measure = () => {
    if (window.innerWidth <= 850) return;
    const available = Math.max(1, container.clientWidth - separatorWidth());
    setMinimum(Math.min(50, (280 / available) * 100));
    setRatio(clamp(ratio()));
  };
  const stop = () => {
    if (pointer !== undefined && separator.hasPointerCapture(pointer))
      separator.releasePointerCapture(pointer);
    pointer = undefined;
    setDragging(false);
  };
  onMount(() => {
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    measure();
    onCleanup(() => {
      observer.disconnect();
      stop();
    });
  });
  return (
    <div
      ref={(element) => {
        container = element;
      }}
      class="workbench-panels"
      classList={{ "is-resizing": dragging() }}
      style={{
        "grid-template-columns": `${ratio()}fr var(--layout-gap) ${100 - ratio()}fr`,
      }}
    >
      {props.left}
      <div
        ref={(element) => {
          separator = element;
        }}
        class="panel-separator"
        role="separator"
        tabindex="0"
        aria-label="调整 Schema 与预览宽度"
        aria-orientation="vertical"
        aria-valuenow={ratio()}
        aria-valuemin={minimum()}
        aria-valuemax={100 - minimum()}
        aria-valuetext={`Schema ${Math.round(ratio())}%`}
        onPointerDown={(event) => {
          if (event.button !== 0 || pointer !== undefined) return;
          event.preventDefault();
          measure();
          pointer = event.pointerId;
          separator.focus();
          separator.setPointerCapture(pointer);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (pointer !== event.pointerId) return;
          const bounds = container.getBoundingClientRect();
          const gap = separatorWidth();
          setRatio(
            clamp(
              ((event.clientX - bounds.left - gap / 2) / Math.max(1, bounds.width - gap)) * 100,
            ),
          );
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onKeyDown={(event) => {
          const value = {
            ArrowLeft: ratio() - 2,
            ArrowRight: ratio() + 2,
            Home: minimum(),
            End: 100 - minimum(),
          }[event.key];
          if (value === undefined) return;
          event.preventDefault();
          setRatio(clamp(value));
        }}
      >
        <span aria-hidden="true" />
      </div>
      {props.right}
    </div>
  );
};
