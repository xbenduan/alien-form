import { useState } from "react";
import { Button, Card, Space } from "antd";
import {
  FormBlockRenderer,
  useBlock,
  useListBlock,
  type ComponentProps,
  type FormBlockRuntime,
} from "@alien-form/engine/react";
import styles from "../ui.module.css";

export function Filter({ node }: ComponentProps) {
  const list = useListBlock((node.props?.listBlock as string | undefined) ?? "main");
  const blockName = node.block ?? "filter";
  const filter = useBlock(blockName) as FormBlockRuntime;
  const [expanded, setExpanded] = useState(false);
  const fieldCount = Object.keys(filter.form.schema.properties ?? {}).length;
  const hasExtraFields = fieldCount > 4;

  const handleReset = () => {
    filter.reset();
    list.setFilters({});
  };

  return (
    <Card className={styles.filterCard} styles={{ body: { padding: 16 } }}>
      <div
        className={`${styles.filter}${
          expanded || !hasExtraFields ? "" : ` ${styles.filterCollapsed}`
        }`}
      >
        <div className={styles.filterFields}>
          <FormBlockRenderer blockName={blockName} />
        </div>
        <div className={styles.filterActions}>
          <Space>
            {hasExtraFields ? (
              <Button type="link" onClick={() => setExpanded((current) => !current)}>
                {expanded ? "收起" : "展开"}
              </Button>
            ) : null}
            <Button loading={list.loading} onClick={handleReset}>
              重置
            </Button>
            <Button
              type="primary"
              loading={list.loading}
              onClick={() => list.setFilters(filter.form.values())}
            >
              查询
            </Button>
          </Space>
        </div>
      </div>
    </Card>
  );
}
