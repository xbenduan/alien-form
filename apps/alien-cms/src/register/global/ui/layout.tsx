import { Flex } from "antd";
import type { AfUiNode, PageContext } from "../../../runtime";
import { RenderChildren } from "../../../runtime";
import styles from "../ui.module.css";

export function TreeLayout({ ctx, slots = {} }: { ctx: PageContext; slots?: Record<string, AfUiNode[]> }) {
  return (
    <Flex align="stretch" gap={16} className={styles.treeLayout}>
      <div className={styles.treePane}>
        <RenderChildren children={slots.tree ?? []} ctx={ctx} />
      </div>
      <div className={styles.treeContent}>
        <RenderChildren children={slots.filter ?? []} ctx={ctx} />
        <RenderChildren children={slots.table ?? []} ctx={ctx} />
      </div>
    </Flex>
  );
}
