import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "@binding";
import styles from "./index.module.css";

interface TreeItem {
  key: string;
  title: string;
  children?: TreeItem[];
}

interface TreeDataOptions {
  model: string;
  parentField: string;
  labelField: string;
  valueField?: string;
}

function collectExpandableKeys(nodes: TreeItem[]): string[] {
  return nodes.flatMap((node) =>
    node.children?.length ? [node.key, ...collectExpandableKeys(node.children)] : [],
  );
}

function TreeNode({
  node,
  depth,
  expanded,
  selectedKey,
  onSelect,
  onToggle,
}: {
  node: TreeItem;
  depth: number;
  expanded: Set<string>;
  selectedKey?: string;
  onSelect: (key: string) => void;
  onToggle: (key: string) => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const isExpanded = expanded.has(node.key);
  const selected = selectedKey === node.key;
  return (
    <li>
      <div className={styles.treeNode} style={{ paddingLeft: `${depth * 16 + 8}px` }}>
        {hasChildren ? (
          <button
            type="button"
            className={styles.treeToggle}
            aria-label={isExpanded ? "收起" : "展开"}
            aria-expanded={isExpanded}
            onClick={() => onToggle(node.key)}
          >
            <span className={isExpanded ? styles.treeChevronOpen : styles.treeChevron} />
          </button>
        ) : (
          <span className={styles.treeTogglePlaceholder} />
        )}
        <button
          type="button"
          className={`${styles.treeItem}${selected ? ` ${styles.treeItemSelected}` : ""}`}
          aria-pressed={selected}
          onClick={() => onSelect(node.key)}
        >
          {node.title}
        </button>
      </div>
      {hasChildren && isExpanded ? (
        <ul className={styles.treeBranch}>
          {node.children?.map((child) => (
            <TreeNode
              key={child.key}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedKey={selectedKey}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function Tree({
  title,
  value,
  onChange,
  loadData,
  model,
  parentField,
  labelField,
  valueField,
}: ComponentProps &
  TreeDataOptions & {
    title?: string;
    loadData?: (options: TreeDataOptions) => Promise<TreeItem[]>;
  }) {
  const [nodes, setNodes] = useState<TreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const loaderRef = useRef(loadData);
  const selectedKey = value == null ? undefined : String(value);

  useEffect(() => {
    loaderRef.current = loadData;
  }, [loadData]);

  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;
    let active = true;
    setLoading(true);
    void loader({
      model,
      parentField,
      labelField,
      valueField,
    })
      .then((nextNodes) => {
        if (!active) return;
        setNodes(nextNodes);
        setExpanded(new Set(collectExpandableKeys(nextNodes)));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const tree = useMemo(
    () =>
      nodes.map((node) => (
        <TreeNode
          key={node.key}
          node={node}
          depth={0}
          expanded={expanded}
          selectedKey={selectedKey}
          onSelect={(key) => onChange?.(key === selectedKey ? undefined : key)}
          onToggle={(key) =>
            setExpanded((current) => {
              const next = new Set(current);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            })
          }
        />
      )),
    [expanded, nodes, onChange, selectedKey],
  );

  return (
    <section className={styles.treeCard}>
      {title ? <header className={styles.treeHeader}>{title}</header> : null}
      <div className={styles.treeContent} aria-busy={loading}>
        {nodes.length ? (
          <ul className={styles.tree}>{tree}</ul>
        ) : (
          <p className={styles.treeEmpty}>暂无分组</p>
        )}
      </div>
    </section>
  );
}
