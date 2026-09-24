import { SearchOutlined } from "@ant-design/icons";
import { Card, Input, Spin } from "antd";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "@alien-form/react";
import { Tree, type TreeNode } from "../../../components/tree";
import type { TreeOptions } from "../utils/tree";
import { useLayoutLoading } from "./loading-context";

interface TreeLayoutOptions extends TreeOptions {
  showRoot?: boolean;
}

type TreeLoader = (options: TreeOptions) => Promise<TreeNode[]>;

/** 组合远程树数据、搜索框与共享 Tree 主体的页面适配器。 */
export function TreeLayout({
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
  TreeLayoutOptions & {
    title?: string;
    loadData?: TreeLoader;
  }) {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const loaderRef = useRef(loadData);
  const { loading, startLoading } = useLayoutLoading();
  const deferredKeyword = useDeferredValue(keyword);

  useEffect(() => {
    loaderRef.current = loadData;
  }, [loadData]);

  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;
    let active = true;
    setLoadFailed(false);
    const stopLoading = startLoading();
    void loader({
      model,
      parentField,
      labelField,
      valueField,
    })
      .then((nextNodes) => {
        if (active) setNodes(nextNodes);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      })
      .finally(() => {
        stopLoading();
      });
    return () => {
      active = false;
    };
  }, [labelField, model, parentField, startLoading, valueField]);

  const visibleNodes = useMemo(
    () => (showRoot || nodes.length !== 1 ? nodes : (nodes[0]?.children ?? [])),
    [nodes, showRoot],
  );

  return (
    <Card
      className="h-full min-h-[520px] overflow-hidden max-[900px]:min-h-[320px]"
      styles={{ body: { height: "100%", padding: 0 } }}
    >
      {title ? (
        <header className="border-b border-[#e8edf3] bg-[var(--app-surface-muted,rgba(248,250,255,0.78))] px-4 py-3 text-sm font-medium text-[#172033]">
          {title}
        </header>
      ) : null}
      <Spin spinning={loading}>
        <div className="min-h-[120px] p-2.5" aria-busy={loading}>
          <Input
            className="mb-2.5 rounded-md"
            allowClear
            placeholder="搜索节点"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Tree
            nodes={nodes.length === 0 && loadFailed ? [] : visibleNodes}
            value={value}
            searchValue={deferredKeyword}
            emptyText={loadFailed ? "树数据加载失败" : "暂无分组"}
            allowClearSelection
            onChange={onChange}
          />
        </div>
      </Spin>
    </Card>
  );
}
