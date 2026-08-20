import type { ReactElement } from "react";

interface IdenticonProps {
  /** 用于生成图案的种子，相同种子得到相同头像。 */
  seed: string;
  size?: number;
}

const GRID = 5;
const HALF = Math.ceil(GRID / 2);

/** 简单的 32 位字符串哈希，保证同一种子结果稳定。 */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** GitHub 风格的马赛克默认头像：5×5 左右对称网格，颜色由种子推导。 */
export function Identicon({ seed, size = 35 }: IdenticonProps) {
  const hash = hashString(seed || "anonymous");
  const color = `hsl(${hash % 360}, 52%, 55%)`;
  const cell = size / GRID;

  const rects: ReactElement[] = [];
  for (let row = 0; row < GRID; row += 1) {
    for (let col = 0; col < HALF; col += 1) {
      const on = ((hash >> (row * HALF + col)) & 1) === 1;
      if (!on) continue;
      const mirror = GRID - 1 - col;
      const y = row * cell;
      rects.push(<rect key={`${row}-${col}`} x={col * cell} y={y} width={cell} height={cell} />);
      if (mirror !== col) {
        rects.push(
          <rect key={`${row}-${col}-m`} x={mirror * cell} y={y} width={cell} height={cell} />,
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
