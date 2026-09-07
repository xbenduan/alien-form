import type { Runtime } from "@alien-form/engine";
import { message } from "antd";
import type { ListRequest, ListResponse } from "@app-types";
import { schemaToColumns, schemaToFilters } from "@utils/schema";

function openRoute(path: string): void {
  window.open(`${window.location.origin}/records${path}`, "_self");
}

type ListService = (request: ListRequest) => ListResponse | Promise<ListResponse>;

/** 把 records.list 适配为关联组件的候选记录加载器。 */
export function relation(service: ListService) {
  return async (request: ListRequest): Promise<Record<string, unknown>[]> => {
    const response = await service(request);
    return response.list;
  };
}

export function registerUtils(runtime: Runtime): void {
  runtime.utils("schemaToColumns", schemaToColumns);
  runtime.utils("schemaToFilters", schemaToFilters);
  runtime.utils("relation", relation);
  runtime.utils("message", message);
  runtime.utils("openRoute", openRoute);
}
