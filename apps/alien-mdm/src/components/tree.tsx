import { CaretRightOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";

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
        className={`flex min-w-0 items-center rounded hover:bg-[rgba(245,247,250,0.72)]${selected ? " bg-[rgba(234,243,255,0.78)]" : ""}`}
        style={{ paddingLeft: `${depth * 16 + 6}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="inline-flex h-8 w-6 flex-[0_0_24px] items-center justify-center border-0 bg-transparent text-[10px] text-[#86909c] cursor-pointer hover:text-[#1677ff] focus-visible:outline-2 focus-visible:outline-[rgba(22,119,255,0.32)] focus-visible:-outline-offset-2"
            aria-label={isExpanded ? "收起" : "展开"}
            onClick={() => onToggle(node.key)}
          >
            <CaretRightOutlined
              className={`transition-transform duration-[160ms]${isExpanded ? " rotate-90" : ""}`}
            />
          </button>
        ) : (
          <span className="inline-flex h-8 w-6 flex-[0_0_24px]" />
        )}
        <button
          type="button"
          className={`min-h-8 w-full min-w-0 overflow-hidden border-0 bg-transparent p-[0_8px_0_2px] text-left text-[#1d2129] text-ellipsis whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[rgba(22,119,255,0.32)] focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:text-[#c9cdd4]${selected ? " font-medium text-[#1677ff]" : ""}`}
          disabled={disabled}
          onClick={() => onChange?.(selected && allowClearSelection ? undefined : node.key)}
        >
          {node.title}
        </button>
      </div>
      {hasChildren && isExpanded ? (
        <ul className="m-0 list-none p-0 text-[13px] text-[#172033]" role="group">
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
    return (
      <p className="m-[24px_8px] text-center text-[13px] text-[#86909c]">
        {keyword ? "未找到匹配节点" : emptyText}
      </p>
    );
  }

  return (
    <ul className="m-0 list-none p-0 text-[13px] text-[#172033]" role="tree">
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
