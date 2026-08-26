import { Input, Card } from "antd";
import { useMemo, useState } from "react";
import { useBlock, useService, type ComponentProps } from "@alien-form/engine/react";
import { ListBlockRuntime } from "@alien-form/engine";
import { Tree, collectExpandable } from "@components/tree";
import { refValue } from "../../../utils/field-values";
import type { TreeNode } from "@components/tree";
import type { ModelRecord } from "../../../runtime/types";
import { useQuery } from "@tanstack/react-query";
import styles from "../ui.module.css";

export function TreePanel({ node }: ComponentProps) {
  const block = useBlock(node.block ?? "main");
  const subtreeService = useService("records.subtree");
  const props = node.props ?? {};

  const model = String(props.model ?? "");
  const idField = String(props.idField ?? "id");
  const parentField = String(props.parentField ?? "parentCode");
  const labelField = String(props.labelField ?? "name");
  const targetField = String(props.targetField ?? idField);
  const includeSelf = props.includeSelf !== false;
  const hideLeaf = props.hideLeaf !== false;

  const subtreeQuery = useQuery({
    queryKey: ["records", model, "subtree", idField, parentField],
    enabled: Boolean(model),
    queryFn: async () => {
      return (await subtreeService.send({ model, idField, parentField })) as {
        list: ModelRecord[];
      };
    },
  });

  const [keyword, setKeyword] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | undefined>();
  const records = subtreeQuery.data?.list ?? [];

  const { nodes, descendants } = useMemo(() => {
    const byParent = new Map<string, ModelRecord[]>();
    records.forEach((record) => {
      const rawId = refValue(record[idField]);
      if (rawId === undefined || rawId === null || rawId === "") return;
      const parent = String(refValue(record[parentField]) ?? "");
      const items = byParent.get(parent) ?? [];
      items.push(record);
      byParent.set(parent, items);
    });
    const build = (parent: string): TreeNode[] =>
      (byParent.get(parent) ?? []).flatMap((record) => {
        const id = String(refValue(record[idField]));
        const children = build(id);
        const hasChildren = (byParent.get(id) ?? []).length > 0;
        if (hideLeaf && !hasChildren) return [];
        return [
          {
            key: id,
            title: String(refValue(record[labelField]) ?? id).replace(
              /^贵州大学科技学院\s*[·|-]\s*/,
              "",
            ),
            children,
          },
        ];
      });
    const collect = (id: string): string[] => [
      ...(includeSelf ? [id] : []),
      ...(byParent.get(id) ?? []).flatMap((record) => collect(String(refValue(record[idField])))),
    ];
    return { nodes: build(""), descendants: collect };
  }, [idField, parentField, labelField, records, includeSelf, hideLeaf]);

  const filteredNodes = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return nodes;
    const match = (items: TreeNode[]): TreeNode[] =>
      items.flatMap((item) => {
        const title = String(item.title).toLowerCase();
        const children = item.children ? match(item.children) : [];
        return title.includes(value) || children.length ? [{ ...item, children }] : [];
      });
    return match(nodes);
  }, [keyword, nodes]);

  return (
    <Card className={styles.treeCard} loading={subtreeQuery.isLoading}>
      <Input.Search
        className={styles.treeSearch}
        allowClear
        placeholder="搜索节点"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        onSearch={() => setExpandedKeys(records.map((record) => String(refValue(record[idField]))))}
      />
      <div className={styles.tree}>
        <Tree
          treeData={filteredNodes}
          selectedKey={selectedKey}
          expandedKeys={keyword ? collectExpandable(filteredNodes) : expandedKeys}
          onExpand={setExpandedKeys}
          onSelect={(key) => {
            setSelectedKey(key);
            if (!(block instanceof ListBlockRuntime)) {
              throw new Error("TreePanel requires a list block");
            }
            block.setFilterPatch({ [targetField]: key ? descendants(key) : undefined });
          }}
        />
      </div>
    </Card>
  );
}
