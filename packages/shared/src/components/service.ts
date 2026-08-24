import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { DataSourceItem } from "@alien-form/react";
import type { FieldService, ServiceResolver } from "../compiler";

/**
 * 字段数据请求上下文：向消费 dataSource 的组件注入 request。
 * 编译产物中的 props.service 是纯数据（{model,valueKey,labelKey,remoteSearch}），
 * 不含闭包；真正的请求能力由这里的 Context 提供（由 app 层填值），
 * 实例销毁不影响已缓存的 schema。
 *
 * 注意：shared 只暴露 Context 本身，其挂载动作由 app 层完成，
 * 以保持组件库不内置应用级上下文挂载器。
 */
export const FieldServiceContext = createContext<ServiceResolver | null>(null);

export function useServiceResolver(): ServiceResolver | null {
  return useContext(FieldServiceContext);
}

interface AsyncOptionsState {
  options: DataSourceItem[];
  loading: boolean;
  onSearch?: (keyword: string) => void;
}

function toOptions(service: FieldService, list: Record<string, unknown>[]): DataSourceItem[] {
  return list.map((item) => ({
    value: item[service.valueKey],
    label: String(item[service.labelKey] ?? item[service.valueKey] ?? ""),
  }));
}

/**
 * props 方案的组件自取逻辑：给定 service 声明，通过注入的 request 拉取选项。
 *  - remoteSearch=false：初次全量拉取，前端本地过滤（返回 onSearch=undefined）。
 *  - remoteSearch=true：初次拉一页，onSearch 时带 keyword 远程搜索。
 */
export function useAsyncOptions(service?: FieldService): AsyncOptionsState {
  const resolveService = useServiceResolver();
  const [options, setOptions] = useState<DataSourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  const fetchOptions = useCallback(
    async (keyword?: string) => {
      const request = resolveService?.("records.list");
      if (!service || !request) return;
      const current = ++reqId.current;
      setLoading(true);
      try {
        const result = await request.send({
          model: service.model,
          filters: keyword ? { [service.labelKey]: keyword } : undefined,
          pagination: { current: 1, pageSize: service.remoteSearch ? 50 : 1000 },
        });
        const { list } = result as { list: Record<string, unknown>[] };
        if (current === reqId.current) setOptions(toOptions(service, list));
      } finally {
        if (current === reqId.current) setLoading(false);
      }
    },
    [resolveService, service],
  );

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  return {
    options,
    loading,
    onSearch: service?.remoteSearch ? (keyword: string) => void fetchOptions(keyword) : undefined,
  };
}

/**
 * 统一取组件选项：service（props 方案，组件自取）优先，
 * 否则用 dataSource（handler 预取 / 静态选项）。
 */
export function useFieldOptions(
  service: FieldService | undefined,
  dataSource: DataSourceItem[] | undefined,
): AsyncOptionsState {
  const async = useAsyncOptions(service);
  if (service) return async;
  return { options: dataSource ?? [], loading: false, onSearch: undefined };
}
