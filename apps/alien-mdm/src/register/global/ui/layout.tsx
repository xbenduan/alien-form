import { RenderNode, type ComponentProps } from "@alien-form/engine/react";
import styles from "../ui.module.css";

/**
 * 通用页面布局：左栏 + 右上 + 右下三个无固定语义的插槽。
 * - left：可选侧栏（如组织树），为空时右栏占满整行；
 * - rightTop / rightBottom：右侧主内容区上下堆叠（如筛选区 + 表格）。
 * 记录型页面的树表 / 纯列表两种形态都由这一个组件承接，差别只在是否配置 left。
 */
export function Layout({ node, children }: ComponentProps) {
  const left = node.slots?.left ?? [];
  const rightTop = node.slots?.rightTop ?? [];
  const rightBottom = node.slots?.rightBottom ?? [];
  const hasLeft = left.length > 0;

  return (
    <div className={hasLeft ? styles.layout : styles.layoutStack}>
      {hasLeft ? (
        <div className={styles.layoutLeft}>
          {left.map((n, i) => (
            <RenderNode key={i} node={n} />
          ))}
        </div>
      ) : null}
      <div className={styles.layoutMain}>
        {rightTop.map((n, i) => (
          <RenderNode key={i} node={n} />
        ))}
        {rightBottom.map((n, i) => (
          <RenderNode key={i} node={n} />
        ))}
        {children as React.ReactNode}
      </div>
    </div>
  );
}
