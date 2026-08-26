import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DataSourceItem } from "@alien-form/react";
import { refValue, type FieldService, type ServiceResolver } from "../compiler";

const OPTION_LIMIT = 10;

/**
 * 字段数据请求上下文：向消费 dataSource 的组件注入 request。
 * 编译产物中的 props.service 是纯数据（{ model, valueKey, labelKey }），
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
  load: () => void;
}

function valueKey(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}

/**
 * props 方案的组件自取逻辑：给定 service 声明，通过注入的 request 拉取选项。
 * 首次最多取 10 条。服务端同时批量补回已选项，并返回 total；
 * total 超过阈值时，组件自动切换到远程搜索。
 */
export function useAsyncOptions(service?: FieldService, value?: unknown): AsyncOptionsState {
  const resolveService = useServiceResolver();
  const [options, setOptions] = useState<DataSourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [remoteSearch, setRemoteSearch] = useState(false);
  const reqId = useRef(0);
  const selectedKey = valueKey(value);

  const selected = useMemo(
    () =>
      (Array.isArray(value) ? value : [value])
        .map(refValue)
        .filter(
          (item): item is string | number => typeof item === "string" || typeof item === "number",
        ),
    [selectedKey],
  );

  const fetchOptions = useCallback(
    async (keyword?: string, updateSearchMode = false) => {
      const request = resolveService?.("records.options");
      if (!service || !request) return;
      const current = ++reqId.current;
      setLoading(true);
      try {
        const result = await request.send({
          model: service.model,
          valueKey: service.valueKey,
          labelKey: service.labelKey,
          keyword,
          selectedValues: selected,
          limit: OPTION_LIMIT,
        });
        const { options: nextOptions, total } = result as {
          options: DataSourceItem[];
          total: number;
        };
        if (current === reqId.current) {
          setOptions(nextOptions);
          if (updateSearchMode) setRemoteSearch(total > OPTION_LIMIT);
        }
      } finally {
        if (current === reqId.current) setLoading(false);
      }
    },
    [resolveService, selected, service],
  );

  useEffect(() => {
    setRemoteSearch(false);
  }, [selectedKey, service]);

  const load = useCallback(() => {
    void fetchOptions(undefined, true);
  }, [fetchOptions]);

  return {
    options,
    loading,
    onSearch: remoteSearch ? (keyword: string) => void fetchOptions(keyword) : undefined,
    load,
  };
}

/**
 * 统一取组件选项：service（props 方案，组件自取）优先，
 * 否则用 dataSource（handler 预取 / 静态选项）。
 */
export function useFieldOptions(
  service: FieldService | undefined,
  dataSource: DataSourceItem[] | undefined,
  value?: unknown,
): AsyncOptionsState {
  const async = useAsyncOptions(service, value);
  if (service) return async;
  return { options: dataSource ?? [], loading: false, onSearch: undefined, load: () => {} };
}
