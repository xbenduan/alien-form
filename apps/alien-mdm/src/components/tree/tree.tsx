import { useCallback, useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { RightOutlined } from "@ant-design/icons";
import styles from "./index.module.css";

export interface TreeNode {
  /** 节点唯一标识，也是选中回传的值。 */
  key: string;
  /** 节点展示内容。 */
  title: ReactNode;
  /** 子节点；无子节点即为叶子。 */
  children?: TreeNode[];
  /** 禁用后不可选中（但仍可展开）。 */
  disabled?: boolean;
}

export interface TreeProps {
  /** 树数据（层级结构）。 */
  treeData: TreeNode[];
  /** 单选：受控选中值。 */
  selectedKey?: string;
  /** 选中回调；点击已选中项回传 undefined（取消选中）。 */
  onSelect?: (key: string | undefined, node: TreeNode) => void;
  /** 受控展开的 key 列表；不传则组件自管展开态。 */
  expandedKeys?: string[];
  /** 展开态变化回调。 */
  onExpand?: (keys: string[]) => void;
  /** 首次渲染是否展开全部（仅在非受控展开时生效）。 */
  defaultExpandAll?: boolean;
  /** 空数据占位。 */
  emptyText?: ReactNode;
  className?: string;
}

/** 展开/收起箭头（antd RightOutlined），展开态由 CSS 旋转 90°。 */
function Chevron() {
  return <RightOutlined className={styles.chevron} aria-hidden />;
}

/** 收集全部含子节点的 key，用于 defaultExpandAll / 搜索时全展开。 */
export function collectExpandable(nodes: TreeNode[], acc: string[] = []): string[] {
  nodes.forEach((node) => {
    if (node.children && node.children.length > 0) {
      acc.push(node.key);
      collectExpandable(node.children, acc);
    }
  });
  return acc;
}

interface RowProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  selectedKey?: string;
  onToggle: (key: string) => void;
  onSelect: (node: TreeNode) => void;
}

function TreeRow({ node, depth, expanded, selectedKey, onToggle, onSelect }: RowProps) {
  const hasChildren = !!node.children && node.children.length > 0;
  const isOpen = expanded.has(node.key);
  const isSelected = selectedKey != null && selectedKey === node.key;

  const handleSelect = () => {
    if (node.disabled) return;
    onSelect(node);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect();
    } else if (event.key === "ArrowRight" && hasChildren && !isOpen) {
      onToggle(node.key);
    } else if (event.key === "ArrowLeft" && hasChildren && isOpen) {
      onToggle(node.key);
    }
  };

  return (
    <div className={styles.group} role="group">
      <div
        className={styles.row}
        role="treeitem"
        tabIndex={node.disabled ? -1 : 0}
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isOpen : undefined}
        data-selected={isSelected}
        data-disabled={node.disabled ? true : undefined}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
      >
        {hasChildren ? (
          <button
            type="button"
            className={styles.toggle}
            data-open={isOpen}
            aria-label={isOpen ? "收起" : "展开"}
            onClick={(event) => {
              event.stopPropagation();
              onToggle(node.key);
            }}
          >
            <Chevron />
          </button>
        ) : (
          <span className={styles.toggleSpacer} aria-hidden />
        )}
        <span className={styles.title}>{node.title}</span>
      </div>
      {hasChildren && isOpen ? (
        <div>
          {node.children!.map((child) => (
            <TreeRow
              key={child.key}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedKey={selectedKey}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 自绘树（shadcn 视觉）：单选 + 展开/收起，支持受控/非受控展开态。
 * 用于替换 antd Tree / TreeSelect 内部的 antd 树，保持无外部 UI 依赖。
 */
export function Tree({
  treeData,
  selectedKey,
  onSelect,
  expandedKeys,
  onExpand,
  defaultExpandAll = false,
  emptyText = "暂无数据",
  className,
}: TreeProps) {
  const [innerExpanded, setInnerExpanded] = useState<string[]>(() =>
    defaultExpandAll ? collectExpandable(treeData) : [],
  );

  const controlled = expandedKeys !== undefined;
  const expanded = useMemo(
    () => new Set(controlled ? expandedKeys : innerExpanded),
    [controlled, expandedKeys, innerExpanded],
  );

  const handleToggle = useCallback(
    (key: string) => {
      const next = new Set(controlled ? expandedKeys : innerExpanded);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      const list = [...next];
      if (!controlled) setInnerExpanded(list);
      onExpand?.(list);
    },
    [controlled, expandedKeys, innerExpanded, onExpand],
  );

  const handleSelect = useCallback(
    (node: TreeNode) => {
      const next = selectedKey === node.key ? undefined : node.key;
      onSelect?.(next, node);
    },
    [selectedKey, onSelect],
  );

  return (
    <div className={className ? `${styles.tree} ${className}` : styles.tree} role="tree">
      {treeData.length === 0 ? (
        <div className={styles.empty}>{emptyText}</div>
      ) : (
        treeData.map((node) => (
          <TreeRow
            key={node.key}
            node={node}
            depth={0}
            expanded={expanded}
            selectedKey={selectedKey}
            onToggle={handleToggle}
            onSelect={handleSelect}
          />
        ))
      )}
    </div>
  );
}
