import { Select as AntSelect, Spin } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "@alien-form/react";
import { Tree, findTreeTitle, type TreeNode } from "../../../components/tree";
import type { TreeOptions } from "../utils/tree";
import { DetailValue, buildProps, isReferenceValue, referenceValue } from "./shared";

type TreeLoader = (options: TreeOptions) => Promise<TreeNode[]>;

interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

/** 未配置禁用节点时复用稳定空数组。 */
const EMPTY_DISABLED_VALUES: unknown[] = [];

/** 将树节点展平为 Select 的值与标签映射。 */
function treeOptions(
  nodes: TreeNode[],
  disabledKeys: Set<string>,
  parentDisabled = false,
): SelectOption[] {
  return nodes.flatMap((node) => {
    const disabled = parentDisabled || disabledKeys.has(node.key);
    return [
      { value: node.key, label: node.title, disabled },
      ...treeOptions(node.children, disabledKeys, disabled),
    ];
  });
}

/** 保留当前引用标签，保证树数据加载前即可回显。 */
function referenceOptions(value: unknown): SelectOption[] {
  return isReferenceValue(value)
    ? [{ value: String(value.value), label: String(value.label ?? value.value) }]
    : [];
}

/** 合并回显与远程节点选项。 */
function mergeOptions(...groups: SelectOption[][]): SelectOption[] {
  return [...new Map(groups.flat().map((option) => [option.value, option])).values()];
}

/** 使用 Select 承载共享 Tree 主体的自关联字段组件。 */
export function TreeSelect(
  props: ComponentProps &
    TreeOptions & {
      loadData?: TreeLoader;
      disabledValues?: unknown[];
    },
) {
  const { mode, controlProps, value, onChange, loading, extraProps } = buildProps(props, [
    "model",
    "parentField",
    "labelField",
    "valueField",
    "loadData",
    "disabledValues",
  ]);
  const {
    model,
    parentField,
    labelField,
    valueField = "id",
    loadData,
    disabledValues = EMPTY_DISABLED_VALUES,
  } = extraProps as unknown as TreeOptions & {
    loadData?: TreeLoader;
    disabledValues?: unknown[];
  };
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const loaderRef = useRef(loadData);
  const normalizedValue = useMemo(() => {
    const current = referenceValue(value);
    return current === undefined || current === null || current === ""
      ? undefined
      : String(current);
  }, [value]);
  const normalizedDisabledValues = useMemo(
    () => disabledValues.map(referenceValue),
    [disabledValues],
  );
  const disabledKeys = useMemo(
    () =>
      new Set(
        normalizedDisabledValues
          .filter((item) => item !== undefined && item !== null && item !== "")
          .map(String),
      ),
    [normalizedDisabledValues],
  );
  const options = useMemo(
    () => mergeOptions(referenceOptions(value), treeOptions(nodes, disabledKeys)),
    [disabledKeys, nodes, value],
  );

  useEffect(() => {
    loaderRef.current = loadData;
  }, [loadData]);

  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;
    let active = true;
    setLoadFailed(false);
    setRemoteLoading(true);
    void loader({ model, parentField, labelField, valueField })
      .then((nextNodes) => {
        if (!active) return;
        setNodes(nextNodes);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      })
      .finally(() => {
        if (active) setRemoteLoading(false);
      });
    return () => {
      active = false;
    };
  }, [labelField, model, parentField, valueField]);

  if (mode === "detail") {
    const label = isReferenceValue(value)
      ? (value.label ?? value.value)
      : findTreeTitle(nodes, normalizedValue);
    return <DetailValue value={label ?? value} />;
  }

  return (
    <AntSelect
      {...controlProps}
      open={open}
      allowClear
      showSearch={{
        optionFilterProp: "label",
        searchValue,
        onSearch: setSearchValue,
      }}
      placeholder={(controlProps.placeholder as string | undefined) || "请选择"}
      style={{ width: "100%", ...(controlProps.style as object) }}
      value={normalizedValue}
      options={options}
      loading={Boolean(loading) || remoteLoading}
      popupRender={() => (
        <div
          className="max-h-80 min-h-12 overflow-y-auto p-1"
          onMouseDown={(event) => event.preventDefault()}
        >
          <Spin spinning={remoteLoading}>
            <Tree
              nodes={nodes}
              value={normalizedValue}
              searchValue={searchValue}
              disabledValues={normalizedDisabledValues}
              emptyText={loadFailed ? "树数据加载失败" : "暂无数据"}
              onChange={(next) => {
                onChange?.(next);
                if (next !== undefined) setOpen(false);
              }}
            />
          </Spin>
        </div>
      )}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearchValue("");
      }}
      onChange={(next) => onChange?.(next)}
    />
  );
}
