import type { DataSourceItem } from "@alien-form/core";
import type { ListRequest, ListResponse } from "@alien-form/protocol";

type ListService = (request: ListRequest) => ListResponse | Promise<ListResponse>;

export interface ReferenceValue {
  $ref: string;
  value: unknown;
  label?: unknown;
}

export interface RelationOptions {
  valueField: string;
  labelField: string;
}

export function isReferenceValue(value: unknown): value is ReferenceValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Partial<ReferenceValue>).$ref === "string" &&
    "value" in value
  );
}

export function referenceValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(referenceValue);
  return isReferenceValue(value) ? value.value : value;
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
