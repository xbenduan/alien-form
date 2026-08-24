import { Input, Card, Tree } from "antd";
import type { DataNode } from "antd/es/tree";
import { useMemo, useState } from "react";
import type { ModelRecord, PageContext } from "../../../runtime";
import { useRecordList } from "../../../hooks";
import { pageOf } from "./types";
import styles from "../ui.module.css";

export function TreePanel({ ctx, props }: { ctx: PageContext; props: Record<string, unknown> }) {
  const page = pageOf(ctx);
  const model = String(props.model ?? ctx.model);
  const idField = String(props.idField ?? "userNo");
  const parentField = String(props.parentField ?? "parentCode");
  const labelField = String(props.labelField ?? "displayName");
  const targetField = String(props.targetField ?? idField);
  const includeSelf = props.includeSelf !== false;
  // hideLeaf：是否丢弃无子节点的叶子。school-user 树里叶子是学生（隐藏）→ 缺省 true；
  // 部门树里班级/党团组织是叶子但必须可点选 → 布局显式传 hideLeaf:false 保留。
  const hideLeaf = props.hideLeaf !== false;
  const treeQuery = useRecordList({
    model,
    filters: {},
    pagination: { current: 1, pageSize: 1000 },
    enabled: true,
  });
  const [keyword, setKeyword] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const records = (treeQuery.data?.list ?? []) as ModelRecord[];

  const { nodes, descendants } = useMemo(() => {
    const byParent = new Map<string, ModelRecord[]>();
    records.forEach((record) => {
      const rawId = record[idField];
      if (rawId === undefined || rawId === null || rawId === "") return;
      const parent = String(record[parentField] ?? "");
      const items = byParent.get(parent) ?? [];
      items.push(record);
      byParent.set(parent, items);
    });
    const build = (parent: string): DataNode[] =>
      (byParent.get(parent) ?? []).flatMap((record) => {
        const id = String(record[idField]);
        const children = build(id);
        const hasChildren = (byParent.get(id) ?? []).length > 0;
        if (hideLeaf && !hasChildren) return [];
        return [
          {
            key: id,
            title: String(record[labelField] ?? id).replace(/^贵州大学科技学院\s*[·|-]\s*/, ""),
            children,
          },
        ];
      });
    const collect = (id: string): string[] => [
      ...(includeSelf ? [id] : []),
      ...(byParent.get(id) ?? []).flatMap((record) => collect(String(record[idField]))),
    ];
    return { nodes: build(""), descendants: collect };
  }, [idField, parentField, labelField, records, includeSelf, hideLeaf]);

  const filteredNodes = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return nodes;
    const match = (items: DataNode[]): DataNode[] =>
      items.flatMap((item) => {
        const title = String(item.title).toLowerCase();
        const children = item.children ? match(item.children as DataNode[]) : [];
        return title.includes(value) || children.length ? [{ ...item, children }] : [];
      });
    return match(nodes);
  }, [keyword, nodes]);

  return (
    <Card className={styles.treeCard} loading={treeQuery.isLoading}>
      <Input.Search
        className={styles.treeSearch}
        allowClear
        placeholder="搜索节点"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        onSearch={() => setExpandedKeys(records.map((record) => String(record[idField])))}
      />
      <Tree
        className={styles.tree}
        blockNode
        showLine
        treeData={filteredNodes}
        expandedKeys={expandedKeys}
        onExpand={setExpandedKeys}
        onSelect={(keys) => {
          const id = keys[0] == null ? undefined : String(keys[0]);
          page.setLayoutFilters(id ? { [targetField]: descendants(id) } : {});
        }}
        onClick={(_, node) => {
          const id = String(node.key);
          page.setLayoutFilters({ [targetField]: descendants(id) });
        }}
      />
    </Card>
  );
}
