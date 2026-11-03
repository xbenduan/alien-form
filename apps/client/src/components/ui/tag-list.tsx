import { createSignal, For, Show } from "solid-js";
import type { Component } from "solid-js";

/** 展示有序标签，折叠只影响可见数量，不修改原始值。 */
export const TagList: Component<{
  labels: readonly string[];
  maxTagCount?: number;
}> = (props) => {
  const [expanded, setExpanded] = createSignal(false);
  const count = () => (expanded() ? props.labels.length : (props.maxTagCount ?? 3));
  return (
    <span class="tag-list">
      <For each={props.labels.slice(0, count())}>
        {(label) => <span class="value-badge">{label}</span>}
      </For>
      <Show when={props.labels.length > count()}>
        <button
          type="button"
          class="text-button"
          onClick={() => setExpanded(true)}
          aria-label={`展开剩余 ${props.labels.length - count()} 项`}
        >
          +{props.labels.length - count()}
        </button>
      </Show>
      <Show when={props.labels.length === 0}>
        <span class="muted">[]</span>
      </Show>
    </span>
  );
};
