import { TreeSelect as AntTreeSelect } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FieldComponentProps } from "../../types";
import { useFieldMode } from "../field-mode";
import { DisplayValue } from "../DisplayValue";
import { useServiceResolver } from "../service";

interface TreeSelectNode {
  title: string;
  value: string;
  children: TreeSelectNode[];
}

/**
 * 树形单选：从一个模型按「父字段 → 自身字段」拼成层级树供选择，
 * 常用于选择自连接结构的上级节点（如部门的上级部门）。
 *
 * 与 Select/MultiSelect 的 $af-dataSource 方案不同：自连接的连接键是业务编码
 * （如 deptCode）而非记录 id，若挂 $af-dataSource 会被推断成指向 id 的外键。
 * 因此取数配置直接放在字段 props 上，由本组件通过 records.list 自取：
 *  - treeModel：取数模型，缺省用 dataSource.model
 *  - treeIdField：节点自身标识（即回填到本字段的值），缺省 "id"
 *  - treeLabelField：节点展示字段，缺省 treeIdField
 *  - treeParentField：上级标识字段，缺省 "parentCode"
 */
export default function TreeSelect(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  const resolveService = useServiceResolver();

  const treeModel = String(props.treeModel ?? "");
  const idField = String(props.treeIdField ?? "id");
  const labelField = String(props.treeLabelField ?? idField);
  const parentField = String(props.treeParentField ?? "parentCode");

  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const request = resolveService?.("records.list");
    if (!treeModel || !request) return;
    const current = ++reqId.current;
    setLoading(true);
    request
      .send({ model: treeModel, pagination: { current: 1, pageSize: 1000 } })
      .then((result) => {
        const { list } = result as { list: Record<string, unknown>[] };
        if (current === reqId.current) setRecords(list);
      })
      .finally(() => {
        if (current === reqId.current) setLoading(false);
      });
  }, [resolveService, treeModel]);

  const { treeData, labelOf } = useMemo(() => {
    const byParent = new Map<string, Record<string, unknown>[]>();
    const labels = new Map<string, string>();
    records.forEach((record) => {
      const rawId = record[idField];
      if (rawId === undefined || rawId === null || rawId === "") return;
      const id = String(rawId);
      labels.set(id, String(record[labelField] ?? id));
      const parent = String(record[parentField] ?? "");
      const items = byParent.get(parent) ?? [];
      items.push(record);
      byParent.set(parent, items);
    });
    // 排除当前记录自身及其子树，避免把自己或后代选成父级形成环
    const selfId = props.value === undefined ? undefined : String(props.value);
    const build = (parent: string): TreeSelectNode[] =>
      (byParent.get(parent) ?? []).flatMap((record) => {
        const id = String(record[idField]);
        if (id === selfId) return [];
        return [{ title: labels.get(id) ?? id, value: id, children: build(id) }];
      });
    return { treeData: build(""), labelOf: labels };
  }, [records, idField, labelField, parentField, props.value]);

  if (mode === "detail") {
    const value = props.value == null ? undefined : String(props.value);
    const display = value != null ? (labelOf.get(value) ?? value) : value;
    return <DisplayValue value={display} />;
  }

  return (
    <AntTreeSelect
      style={{ width: "100%" }}
      value={props.value as string | undefined}
      onChange={(next) => props.onChange?.(next)}
      disabled={props.disabled}
      loading={props.loading || loading}
      placeholder={props.placeholder}
      treeData={treeData}
      treeDefaultExpandAll
      showSearch
      treeNodeFilterProp="title"
      allowClear
    />
  );
}
