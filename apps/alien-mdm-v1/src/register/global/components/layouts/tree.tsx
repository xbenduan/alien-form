import { Card, Empty, Spin, Tree as AntTree } from "antd";
import { useEffect, useState } from "react";
import type { ComponentProps } from "@binding";
import styles from "./index.module.css";

interface TreeItem {
  key: string;
  title: string;
  children?: TreeItem[];
}

export function Tree({
  value,
  onChange,
  loadData,
}: ComponentProps & { loadData?: () => Promise<TreeItem[]> }) {
  const [nodes, setNodes] = useState<TreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!loadData) return;
    setLoading(true);
    void loadData()
      .then(setNodes)
      .finally(() => setLoading(false));
  }, [loadData]);
  return (
    <Card className={styles.treeCard} size="small">
      <Spin spinning={loading}>
        {nodes.length ? (
          <AntTree
            treeData={nodes}
            selectedKeys={value == null ? [] : [String(value)]}
            onSelect={(keys) => onChange?.(keys[0])}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分组" />
        )}
      </Spin>
    </Card>
  );
}
