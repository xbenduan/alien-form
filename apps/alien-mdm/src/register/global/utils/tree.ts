import type { SubtreeRequest, SubtreeResponse } from "@app-types";

type SubtreeService = (request: SubtreeRequest) => SubtreeResponse | Promise<SubtreeResponse>;

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

/** 消费 records.subtree 返回的平铺节点，并装配为嵌套树。 */
export function tree(service: SubtreeService) {
  return async (options: TreeOptions): Promise<TreeNode[]> => {
    const { model, parentField, labelField, valueField = "id" } = options;

    const records = await service({ model, idField: valueField, parentField });

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
