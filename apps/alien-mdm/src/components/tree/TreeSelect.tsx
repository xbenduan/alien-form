import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Select } from "antd";
import { Tree, collectExpandable } from "./Tree";
import type { TreeNode } from "./Tree";
import styles from "./index.module.css";

export interface TreeSelectComboProps {
  /** 树数据（层级结构）。 */
  treeData: TreeNode[];
  /** 受控选中值。 */
  value?: string;
  /** 选中回调（点击已选项 / 清空回传 undefined）。 */
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  allowClear?: boolean;
  /** 展示搜索（走 antd Select 原生 selector 内搜索框，按 title 过滤）。 */
  showSearch?: boolean;
  className?: string;
}

/** 按 title 文本过滤树，保留命中节点的祖先链。 */
function filterTree(nodes: TreeNode[], keyword: string): TreeNode[] {
  const value = keyword.trim().toLowerCase();
  if (!value) return nodes;
  const walk = (items: TreeNode[]): TreeNode[] =>
    items.flatMap((item) => {
      const children = item.children ? walk(item.children) : [];
      const title = typeof item.title === "string" ? item.title.toLowerCase() : "";
      if (title.includes(value) || children.length) return [{ ...item, children }];
      return [];
    });
  return walk(nodes);
}

/** 在树里按 key 找节点，用于给 antd Select 补一个选项以正确回显 label。 */
function findNode(nodes: TreeNode[], key: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.key === key) return node;
    if (node.children) {
      const found = findNode(node.children, key);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * 树形单选组合框：外壳复用 antd Select（保证与表单其它字段的尺寸/边框/清空按钮/宽度一致），
 * 下拉内容用自绘 Tree（shadcn 视觉）通过 popupRender 替换默认菜单。
 * 搜索走 Select selector 内的原生输入框，过滤后的树在 popup 中全展开。
 */
export function TreeSelect({
  treeData,
  value,
  onChange,
  placeholder = "请选择",
  disabled,
  loading,
  allowClear = true,
  showSearch = true,
  className,
}: TreeSelectComboProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");

  // 关闭时清掉搜索词，下次打开回到完整树
  useEffect(() => {
    if (!open) setKeyword("");
  }, [open]);

  const filtered = useMemo(() => filterTree(treeData, keyword), [treeData, keyword]);
  // 搜索时把命中链全部展开，保证过滤结果可见。
  const expandedKeys = useMemo(
    () => (keyword ? collectExpandable(filtered) : undefined),
    [keyword, filtered],
  );

  // 给 Select 补一个当前选中项的 option，使 selector 能回显 label 而非裸值。
  const options = useMemo<{ value: string; label: ReactNode }[]>(() => {
    if (value == null || value === "") return [];
    const node = findNode(treeData, value);
    return [{ value, label: node?.title ?? value }];
  }, [treeData, value]);

  return (
    <Select
      className={className}
      style={{ width: "100%" }}
      value={value == null || value === "" ? undefined : value}
      open={open}
      onOpenChange={setOpen}
      placeholder={placeholder}
      disabled={disabled}
      loading={loading}
      allowClear={allowClear}
      showSearch={
        showSearch ? { searchValue: keyword, onSearch: setKeyword, filterOption: false } : false
      }
      options={options}
      // 清空由 selector 的清除按钮触发，回传 undefined
      onChange={(next) => {
        if (next == null) onChange?.(undefined);
      }}
      popupMatchSelectWidth
      popupRender={() => (
        <div className={styles.selectList}>
          <Tree
            treeData={filtered}
            selectedKey={value}
            expandedKeys={expandedKeys}
            onSelect={(next) => {
              onChange?.(next);
              setOpen(false);
            }}
            emptyText={loading ? "加载中…" : "暂无数据"}
          />
        </div>
      )}
    />
  );
}
