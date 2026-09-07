import type { ListRequest, ListResponse } from "@app-types";
import type { DataSourceItem } from "@alien-form/core";

type ListService = (request: ListRequest) => ListResponse | Promise<ListResponse>;

interface ReferenceValue {
  $ref: string;
  value: unknown;
  label?: unknown;
}

export interface RelationOptions {
  valueField: string;
  labelField: string;
}

function isReferenceValue(value: unknown): value is ReferenceValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "$ref" in value &&
    "value" in value
  );
}

function displayValue(value: unknown): string {
  if (isReferenceValue(value)) return String(value.label ?? value.value);
  return String(value ?? "");
}

/** 将 records.list 适配为关联组件的输入/输出协议。 */
export function relation(service: ListService) {
  return async (request: ListRequest & RelationOptions): Promise<DataSourceItem[]> => {
    const { valueField, labelField, ...listRequest } = request;
    const response = await service(listRequest);
    return response.list.flatMap((item) => {
      const rawValue = item[valueField];
      const value = isReferenceValue(rawValue) ? rawValue.value : rawValue;
      if (value === undefined || value === null || value === "") return [];
      const rawLabel = item[labelField] ?? rawValue;
      return [{ label: displayValue(rawLabel), value, ...item }];
    });
  };
}
