import type { ListRequest, ListResponse } from "@app-types";

type ListService = (request: ListRequest) => ListResponse | Promise<ListResponse>;

interface ReferenceValue {
  $ref: string;
  value: unknown;
}

interface TreeNode {
  key: string;
  title: string;
  children: TreeNode[];
}

export interface TreeOptions {
  model: string;
  parentField: string;
  labelField: string;
  valueField?: string;
  pageSize?: number;
}

function referenceValue(value: unknown): unknown {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "$ref" in value &&
    "value" in value
  ) {
    return (value as ReferenceValue).value;
  }
  return value;
}

function listRequest(model: string, pageSize: number): ListRequest {
  return { model, pagination: { current: 1, pageSize } };
}

/** 将单模型平铺记录按自关联字段转换为可渲染树。 */
export function tree(service: ListService) {
  return async (options: TreeOptions): Promise<TreeNode[]> => {
    const { model, parentField, labelField, valueField = "id", pageSize = 100 } = options;

    const records = await service(listRequest(model, pageSize));

    const nodes = new Map<string, TreeNode>();
    for (const record of records.list) {
      const rawValue = referenceValue(record[valueField]);
      if (rawValue === undefined || rawValue === null || rawValue === "") continue;
      const key = String(rawValue);
      const title = String(record[labelField] ?? rawValue);
      nodes.set(key, {
        key,
        title,
        children: [],
      });
    }

    const roots: TreeNode[] = [];
    for (const record of records.list) {
      const rawValue = referenceValue(record[valueField]);
      if (rawValue === undefined || rawValue === null || rawValue === "") continue;
      const node = nodes.get(String(rawValue));
      if (!node) continue;
      const parentValue = referenceValue(record[parentField]);
      const parent =
        parentValue === undefined || parentValue === null
          ? undefined
          : nodes.get(String(parentValue));
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  };
}
