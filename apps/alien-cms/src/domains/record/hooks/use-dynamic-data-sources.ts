import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { listRecords } from "../../../services";
import type { ModelSchema } from "../../../services";
import { collectDataSourceRequests, type DataSourceMap } from "../utils";

/**
 * 加载 schema 中所有 @loadDataSource 联动字段的选项，
 * 供 table / filter 翻译外键标签。
 */
export function useDynamicDataSources(schema?: ModelSchema): DataSourceMap {
  const requests = useMemo(() => collectDataSourceRequests(schema), [schema]);

  const queries = useQueries({
    queries: requests.map((request) => ({
      queryKey: ["records", request.model, "dataSource", request.valueKey, request.labelKey],
      enabled: Boolean(schema),
      queryFn: async () => {
        const { list } = await listRecords({
          model: request.model,
          pagination: { current: 1, pageSize: 1000 },
        });
        return list.map((item) => ({
          value: item[request.valueKey],
          label: String(item[request.labelKey] ?? item[request.valueKey] ?? ""),
        }));
      },
    })),
  });

  return useMemo(() => {
    const map: DataSourceMap = {};
    requests.forEach((request, index) => {
      const data = queries[index]?.data;
      if (data) map[request.path] = data;
    });
    return map;
  }, [queries, requests]);
}
