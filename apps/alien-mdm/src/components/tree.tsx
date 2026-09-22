import { CaretRightOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import styles from "./tree.module.css";

export interface TreeNode {
  key: string;
  title: string;
  children: TreeNode[];
}

export interface TreeProps {
  nodes: TreeNode[];
  value?: unknown;
  searchValue?: string;
  disabledValues?: unknown[];
  emptyText?: string;
  allowClearSelection?: boolean;
  onChange?: (value: string | undefined) => void;
}

/** 未配置禁用节点时复用稳定空数组。 */
const EMPTY_DISABLED_VALUES: unknown[] = [];

/** 收集所有分支节点，使树在加载和搜索后默认展开。 */
function collectExpandableKeys(nodes: TreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.children.length ? [node.key, ...collectExpandableKeys(node.children)] : [],
  );
}

/** 保留匹配节点及其祖先路径。 */
function filterTree(nodes: TreeNode[], keyword: string): TreeNode[] {
  if (!keyword) return nodes;
  return nodes.flatMap((node) => {
    const children = filterTree(node.children, keyword);
    if (!node.title.toLocaleLowerCase().includes(keyword) && children.length === 0) return [];
    return [{ ...node, children }];
  });
}

/** 查找树节点值对应的展示标题。 */
export function findTreeTitle(nodes: TreeNode[], value: unknown): string | undefined {
  const key = String(value);
  for (const node of nodes) {
    if (node.key === key) return node.title;
    const childTitle = findTreeTitle(node.children, value);
    if (childTitle !== undefined) return childTitle;
  }
  return undefined;
}

function TreeItem({
  node,
  depth,
  expanded,
  selectedKey,
  disabledKeys,
  parentDisabled,
  allowClearSelection,
  onChange,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  selectedKey?: string;
  disabledKeys: Set<string>;
  parentDisabled: boolean;
  allowClearSelection: boolean;
  onChange?: TreeProps["onChange"];
  onToggle: (key: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.key);
  const selected = selectedKey === node.key;
  const disabled = parentDisabled || disabledKeys.has(node.key);

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={selected}
    >
      <div
        className={`${styles.node}${selected ? ` ${styles.nodeSelected}` : ""}`}
        style={{ paddingLeft: `${depth * 16 + 6}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className={styles.toggle}
            aria-label={isExpanded ? "收起" : "展开"}
            onClick={() => onToggle(node.key)}
          >
            <CaretRightOutlined className={isExpanded ? styles.toggleOpen : undefined} />
          </button>
        ) : (
          <span className={styles.togglePlaceholder} />
        )}
        <button
          type="button"
          className={styles.item}
          disabled={disabled}
          onClick={() => onChange?.(selected && allowClearSelection ? undefined : node.key)}
        >
          {node.title}
        </button>
      </div>
      {hasChildren && isExpanded ? (
        <ul className={styles.branch} role="group">
          {node.children.map((child) => (
            <TreeItem
              key={child.key}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedKey={selectedKey}
              disabledKeys={disabledKeys}
              parentDisabled={disabled}
              allowClearSelection={allowClearSelection}
              onChange={onChange}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** 页面布局与树选择器共用的树主体。 */
export function Tree({
  nodes,
  value,
  searchValue = "",
  disabledValues = EMPTY_DISABLED_VALUES,
  emptyText = "暂无数据",
  allowClearSelection = false,
  onChange,
}: TreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const selectedKey = value === undefined || value === null ? undefined : String(value);
  const keyword = searchValue.trim().toLocaleLowerCase();
  const visibleNodes = useMemo(() => filterTree(nodes, keyword), [keyword, nodes]);
  const disabledKeys = useMemo(
    () =>
      new Set(
        disabledValues
          .filter((item) => item !== undefined && item !== null && item !== "")
          .map(String),
      ),
    [disabledValues],
  );

  useEffect(() => {
    setExpanded(new Set(collectExpandableKeys(nodes)));
  }, [nodes]);

  useEffect(() => {
    if (keyword) setExpanded(new Set(collectExpandableKeys(visibleNodes)));
  }, [keyword, visibleNodes]);

  const handleToggle = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (visibleNodes.length === 0) {
    return <p className={styles.empty}>{keyword ? "未找到匹配节点" : emptyText}</p>;
  }

  return (
    <ul className={styles.tree} role="tree">
      {visibleNodes.map((node) => (
        <TreeItem
          key={node.key}
          node={node}
          depth={0}
          expanded={expanded}
          selectedKey={selectedKey}
          disabledKeys={disabledKeys}
          parentDisabled={false}
          allowClearSelection={allowClearSelection}
          onChange={onChange}
          onToggle={handleToggle}
        />
      ))}
    </ul>
  );
}
