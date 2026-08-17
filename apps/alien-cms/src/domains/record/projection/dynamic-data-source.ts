import type { DataSourceItem } from "@alien-form/core";
import type {
  CmsFieldSchema,
  CmsModelSchema,
} from "../../model";
import type { DynamicDataSourceMap } from "./filter";
import { visitSchemaFields } from "./field-traversal";

export interface DynamicDataSourceRequest {
  path: string;
  model: string;
  valueKey: string;
  labelKey: string;
}

function readRequest(
  path: string,
  field: CmsFieldSchema,
): DynamicDataSourceRequest | undefined {
  const config = field["x-cms"]?.reactions?.dataSource;
  const model = config?.model;
  if (typeof model !== "string" || !model) {
    return undefined;
  }

  const valueKey =
    typeof config.value === "string" && config.value
      ? config.value
      : "id";
  const labelKey =
    typeof config.label === "string" && config.label
      ? config.label
      : valueKey;

  return {
    path,
    model,
    valueKey,
    labelKey,
  };
}

export function collectDynamicDataSourceRequests(
  schema: CmsModelSchema | undefined,
): DynamicDataSourceRequest[] {
  const requests: DynamicDataSourceRequest[] = [];
  visitSchemaFields(schema, ({ path, field }) => {
    const request = readRequest(path, field);
    if (request) {
      requests.push(request);
    }
  });
  return requests;
}

export function buildDynamicDataSourceMap(
  requests: DynamicDataSourceRequest[],
  queryResults: Array<{ data?: DataSourceItem[] }>,
): DynamicDataSourceMap {
  return Object.fromEntries(
    requests.map((request, index) => [
      request.path,
      queryResults[index]?.data ?? [],
    ]),
  );
}
