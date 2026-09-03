import type { CSSProperties } from "react";

const GRID_COLUMNS = 24;

type GridStyle = CSSProperties & Record<`--alien-grid-${string}`, string | number>;

export interface FieldGridProps {
  gridSpan?: unknown;
  columns?: unknown;
  gutter?: unknown;
}

function clampSpan(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(GRID_COLUMNS, Math.max(1, Math.floor(value)));
}

function gapValue(value: unknown, fallback: number): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.max(0, value)}px`
    : `${fallback}px`;
}

export function fieldGridStyle({ gridSpan, columns, gutter }: FieldGridProps): GridStyle {
  const columnCount =
    typeof columns === "number" && Number.isFinite(columns)
      ? Math.min(GRID_COLUMNS, Math.max(1, Math.floor(columns)))
      : 1;
  const span = clampSpan(gridSpan) ?? Math.max(1, Math.floor(GRID_COLUMNS / columnCount));
  const [columnGap, rowGap] = Array.isArray(gutter) ? gutter : [gutter, gutter];

  return {
    "--alien-grid-default-span": span,
    "--alien-grid-column-gap": gapValue(columnGap, 8),
    "--alien-grid-row-gap": gapValue(rowGap, 8),
  };
}

export function fieldGridItemStyle(gridSpan: unknown): GridStyle | undefined {
  const span = clampSpan(gridSpan);
  return span ? { "--alien-grid-item-span": span } : undefined;
}
