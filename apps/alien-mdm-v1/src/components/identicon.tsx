import type { ReactElement } from "react";

const GRID = 5;
const HALF = Math.ceil(GRID / 2);

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function Identicon({ seed, size = 35 }: { seed: string; size?: number }) {
  const hash = hashString(seed || "anonymous");
  const color = `hsl(${hash % 360}, 52%, 55%)`;
  const cell = size / GRID;
  const rects: ReactElement[] = [];

  for (let row = 0; row < GRID; row += 1) {
    for (let column = 0; column < HALF; column += 1) {
      if (((hash >> (row * HALF + column)) & 1) !== 1) continue;
      const mirror = GRID - 1 - column;
      const y = row * cell;
      rects.push(
        <rect key={`${row}-${column}`} x={column * cell} y={y} width={cell} height={cell} />,
      );
      if (mirror !== column) {
        rects.push(
          <rect key={`${row}-${column}-m`} x={mirror * cell} y={y} width={cell} height={cell} />,
        );
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="用户头像"
    >
      <rect width={size} height={size} fill="#eef1f5" />
      <g fill={color}>{rects}</g>
    </svg>
  );
}
