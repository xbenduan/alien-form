import { Space as AntSpace } from "antd";
import type { ComponentProps } from "@alien-form/engine/react";

type SpaceSize = number | "small" | "middle" | "large";

/**
 * 通用间距布局容器：把子节点按 props.size 的间距横向/纵向排列。
 * 取代原先各自为营的 row-actions / action-group —— 间距可配（如工具栏需要间隔、
 * 行内操作可设 size: 0 紧凑排列）。
 */
export function Space({ node, children }: ComponentProps) {
  const size = (node.props?.size as SpaceSize) ?? "small";
  const wrap = node.props?.wrap !== false;
  const direction = (node.props?.direction as "horizontal" | "vertical") ?? "horizontal";
  return (
    <AntSpace size={size} wrap={wrap} direction={direction}>
      {children as React.ReactNode}
    </AntSpace>
  );
}
