import { RenderNode, type ComponentProps } from "@alien-form/engine/react";
import styles from "../ui.module.css";

/**
 * 通用页面布局：左栏 + 右上 + 右下三个无固定语义的插槽。
 * - left：可选侧栏（如组织树），为空时右栏占满整行；
 * - rightTop / rightBottom：右侧主内容区上下堆叠（如筛选区 + 表格）。
 * 记录型页面的树表 / 纯列表两种形态都由这一个组件承接，差别只在是否配置 left。
 */
export function Layout({ node, children }: ComponentProps) {
  const left = node.slots?.left;
  const rightTop = node.slots?.rightTop;
  const rightBottom = node.slots?.rightBottom;

  return (
    <div className={left ? styles.layout : styles.layoutStack}>
      {left ? (
        <div className={styles.layoutLeft}>
          <RenderNode node={left} />
        </div>
      ) : null}
      <div className={styles.layoutMain}>
        {rightTop ? <RenderNode node={rightTop} /> : null}
        {rightBottom ? <RenderNode node={rightBottom} /> : null}
        {children as React.ReactNode}
      </div>
    </div>
  );
}
