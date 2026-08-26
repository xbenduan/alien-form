import { useEffect, useMemo, useRef, useState } from "react";
import { useFormScope } from "@alien-form/react";
import type { FieldComponentProps, FormScope } from "../../../types/shared";
import { DisplayValue } from "@components/DisplayValue";
import { refValue } from "../../../compiler";
import { useServiceResolver } from "@hooks/service";
import { TreeSelect as TreeSelectCombo } from "@components/tree";
import type { TreeNode } from "@components/tree";

/**
 * 树形单选：从一个模型按「父字段 → 自身字段」拼成层级树供选择，
 * 常用于选择自连接结构的上级节点（如部门的上级部门）。
 *
 * 自连接的连接键是业务编码（如 deptCode）而非记录 id，因此取数配置直接放在
 * 字段 props 上，由本组件通过 records.list 自取：
 *  - treeModel：取数模型，缺省用 dataSource.model
 *  - treeIdField：节点自身标识（即回填到本字段的值），缺省 "id"
 *  - treeLabelField：节点展示字段，缺省 treeIdField
 *  - treeParentField：上级标识字段，缺省 "parentCode"
 *
 * UI 使用 shared/components/tree 的自绘 TreeSelect（shadcn 视觉），不再依赖 antd。
 */
export default function TreeSelect(props: FieldComponentProps) {
  const { mode = "edit" } = useFormScope<FormScope>();
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

  const rawValue = refValue(props.value);
  const currentValue = rawValue == null || rawValue === "" ? undefined : String(rawValue);
  // 引用对象自带 label，作为兜底显示名（记录未拉到 / 超分页时仍能回显 name）
  const refLabel =
    typeof props.value === "object" && props.value !== null && "label" in props.value
      ? String((props.value as { label?: unknown }).label ?? "")
      : "";

  const { treeData, labelOf } = useMemo(() => {
    const byParent = new Map<string, Record<string, unknown>[]>();
    const labels = new Map<string, string>();
    records.forEach((record) => {
      const rawId = refValue(record[idField]);
      if (rawId === undefined || rawId === null || rawId === "") return;
      const id = String(rawId);
      labels.set(id, String(refValue(record[labelField]) ?? id));
      // parentField 可能被服务端展开为引用对象 { $ref, value, label }：取其 value 拼树
      const parent = String(refValue(record[parentField]) ?? "");
      const items = byParent.get(parent) ?? [];
      items.push(record);
      byParent.set(parent, items);
    });
    const build = (parent: string): TreeNode[] =>
      (byParent.get(parent) ?? []).map((record) => {
        const id = String(refValue(record[idField]));
        return { key: id, title: labels.get(id) ?? id, children: build(id) };
      });
    const nodes = build("");
    // 兜底：选中值不在已拉取记录里（未加载完 / 超分页 / 悬空引用）时，
    // 用引用 label 拼一个 echo 顶层节点，保证回显出 name 而非 code。
    if (currentValue != null && !labels.has(currentValue)) {
      nodes.unshift({ key: currentValue, title: refLabel || currentValue, children: [] });
      labels.set(currentValue, refLabel || currentValue);
    }
    return { treeData: nodes, labelOf: labels };
  }, [records, idField, labelField, parentField, currentValue, refLabel]);

  if (mode === "detail") {
    const display =
      currentValue != null ? (labelOf.get(currentValue) ?? refLabel ?? currentValue) : currentValue;
    return <DisplayValue value={display} />;
  }

  return (
    <TreeSelectCombo
      treeData={treeData}
      value={currentValue}
      onChange={(next) => props.onChange?.(next)}
      disabled={props.disabled}
      loading={props.loading || loading}
      placeholder={props.placeholder}
      showSearch
      allowClear
    />
  );
}
