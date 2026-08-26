import { RenderNode, type ComponentProps } from "@alien-form/engine/react";
import styles from "../ui.module.css";

export function TreeLayout({ node, children }: ComponentProps) {
  const tree = node.slots?.tree ?? [];
  const filter = node.slots?.filter ?? [];
  const table = node.slots?.table ?? [];

  return (
    <div className={styles.treeLayout}>
      <div className={styles.treePane}>
        {tree.map((n, i) => (
          <RenderNode key={i} node={n} />
        ))}
      </div>
      <div className={styles.treeContent}>
        {filter.map((n, i) => (
          <RenderNode key={i} node={n} />
        ))}
        {table.map((n, i) => (
          <RenderNode key={i} node={n} />
        ))}
        {children as React.ReactNode}
      </div>
    </div>
  );
}
