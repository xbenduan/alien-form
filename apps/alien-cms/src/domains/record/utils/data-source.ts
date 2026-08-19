import { collectLeafFields } from "@alien-form/shared";
import type { ModelFieldSchema, ModelSchema } from "../../../services";

export interface DataSourceRequest {
  path: string;
  model: string;
  valueKey: string;
  labelKey: string;
}

/**
 * 收集 schema 中所有通过 @loadDataSource 联动的字段请求。
 * 用于 table / filter 场景把外键值（id）翻译成可读标签。
 */
export function collectDataSourceRequests(schema?: ModelSchema): DataSourceRequest[] {
  if (!schema) return [];
  const requests: DataSourceRequest[] = [];

  for (const { key, field } of collectLeafFields(schema.properties)) {
    const modelField = field as ModelFieldSchema;
    const reaction = modelField["x-reaction"]?.dataSource;
    if (reaction !== "@loadDataSource") continue;
    const params = modelField["x-handler-params"]?.dataSource ?? {};
    const model = typeof params.model === "string" ? params.model : "";
    if (!model) continue;
    requests.push({
      path: key,
      model,
      valueKey: typeof params.value === "string" && params.value ? params.value : "id",
      labelKey:
        typeof params.label === "string" && params.label
          ? params.label
          : typeof params.value === "string" && params.value
            ? params.value
            : "id",
    });
  }

  return requests;
}
