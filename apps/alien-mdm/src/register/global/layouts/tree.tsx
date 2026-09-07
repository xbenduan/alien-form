import { SearchOutlined } from "@ant-design/icons";
import { Input, Spin } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "@alien-form/react";
import styles from "./tree.module.css";
import { useLayoutLoading } from "./loading-context";

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
  showRoot?: boolean;
}

function collectExpandableKeys(nodes: TreeItem[]): string[] {
  return nodes.flatMap((node) =>
    node.children?.length ? [node.key, ...collectExpandableKeys(node.children)] : [],
  );
}

function filterTree(nodes: TreeItem[], keyword: string): TreeItem[] {
  if (!keyword) return nodes;
  return nodes.flatMap((node) => {
    const children = filterTree(node.children ?? [], keyword);
    if (!node.title.toLocaleLowerCase().includes(keyword) && children.length === 0) return [];
    return [{ ...node, children }];
  });
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
      <div
        className={`${styles.treeNode}${selected ? ` ${styles.treeNodeSelected}` : ""}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
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
  showRoot = false,
}: ComponentProps &
  TreeDataOptions & {
    title?: string;
    loadData?: (options: TreeDataOptions) => Promise<TreeItem[]>;
  }) {
  const [nodes, setNodes] = useState<TreeItem[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [keyword, setKeyword] = useState("");
  const loaderRef = useRef(loadData);
  const { loading, startLoading } = useLayoutLoading();
  const selectedKey = value == null ? undefined : String(value);

  useEffect(() => {
    loaderRef.current = loadData;
  }, [loadData]);

  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;
    let active = true;
    const stopLoading = startLoading();
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
        stopLoading();
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleNodes = useMemo(
    () => (showRoot || nodes.length !== 1 ? nodes : (nodes[0]?.children ?? [])),
    [nodes, showRoot],
  );
  const filteredNodes = useMemo(
    () => filterTree(visibleNodes, keyword.trim().toLocaleLowerCase()),
    [keyword, visibleNodes],
  );
  useEffect(() => {
    if (!keyword.trim()) return;
    setExpanded(new Set(collectExpandableKeys(filteredNodes)));
  }, [filteredNodes, keyword]);
  const tree = useMemo(
    () =>
      filteredNodes.map((node) => (
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
    [expanded, filteredNodes, onChange, selectedKey],
  );

  return (
    <section className={styles.treeCard}>
      {title ? <header className={styles.treeHeader}>{title}</header> : null}
      <Spin spinning={loading}>
        <div className={styles.treeContent} aria-busy={loading}>
          <Input
            className={styles.treeSearch}
            allowClear
            placeholder="搜索节点"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          {filteredNodes.length ? (
            <ul className={styles.tree}>{tree}</ul>
          ) : (
            <p className={styles.treeEmpty}>{keyword ? "未找到匹配节点" : "暂无分组"}</p>
          )}
        </div>
      </Spin>
    </section>
  );
}
