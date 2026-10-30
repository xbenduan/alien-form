import type { Component } from "solid-js";

type IconName =
  | "grid"
  | "orders"
  | "content"
  | "model"
  | "arrow"
  | "chevron"
  | "plus"
  | "filter"
  | "refresh"
  | "code"
  | "preview"
  | "check"
  | "close"
  | "upload"
  | "spark"
  | "layers";
type MenuIconName = "pin" | "user" | "roles";

const paths: Record<IconName | MenuIconName, string> = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  orders: "M7 3h10l3 4v14H4V7z M4 7h16 M9 11h6 M9 15h6",
  content: "M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h5",
  model: "M12 2l9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10 M7.5 4.5l9 5",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  chevron: "M9 5l7 7-7 7",
  plus: "M12 5v14 M5 12h14",
  filter: "M4 6h16 M7 12h10 M10 18h4",
  refresh: "M20 7v5h-5 M4 17v-5h5 M6.3 6.3A8 8 0 0120 12 M17.7 17.7A8 8 0 014 12",
  code: "M8 6l-6 6 6 6 M16 6l6 6-6 6 M14 3l-4 18",
  preview: "M2 4h20v14H2z M8 22h8 M12 18v4 M2 8h20",
  check: "M5 12l4 4L19 6",
  close: "M6 6l12 12 M6 18L18 6",
  upload: "M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6",
  spark: "M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z",
  layers: "M12 2l10 6-10 6L2 8z M2 12l10 6 10-6 M2 16l10 6 10-6",
  pin: "M9 3h6 M10 3v6l-4 4v2h12v-2l-4-4V3 M12 15v7",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0 M4 21v-2a8 8 0 0116 0v2",
  roles: "M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6",
};

/** 提供应用共用的线性图标，装饰图标不参与可访问名称。 */
export const Icon: Component<{ name: IconName | MenuIconName; class?: string }> = (props) => (
  <svg
    class={props.class ?? "ui-icon"}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d={paths[props.name]} />
  </svg>
);

/** 绘制 Alien Form 的折叠模型标记。 */
export const BrandMark: Component = () => (
  <svg class="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <path d="M20 3L36 12V28L20 37L4 28V12L20 3Z" stroke="currentColor" stroke-width="1.5" />
    <path d="M20 10L30 16V24L20 30L10 24V16L20 10Z" fill="currentColor" fill-opacity=".12" />
    <path
      d="M10 16L20 22L30 16M20 22V30M10 24V16L20 10L30 16V24"
      stroke="currentColor"
      stroke-width="2"
    />
  </svg>
);
