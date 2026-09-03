import type { FieldNode, ModelDraft } from "./types";

/** 命令：全部为不可变纯函数（接收 draft 返回新 draft）。 */
export type ModelAction =
  | { type: "meta.update"; patch: Partial<Omit<ModelDraft, "fields" | "groups">> }
  | { type: "field.add"; node: FieldNode; parentId?: string; index?: number }
  | { type: "field.update"; id: string; node: FieldNode }
  | { type: "field.remove"; id: string }
  | { type: "field.duplicate"; id: string; node: FieldNode }
  | { type: "field.move"; id: string; parentId?: string; toIndex: number }
  | { type: "groups.replace"; groups: ModelDraft["groups"] }
  | { type: "replace"; draft: ModelDraft };

// ---- 树维护工具（同 alien-mdm 参考，纯函数式）----

function mapFields(
  fields: FieldNode[],
  fn: (list: FieldNode[]) => FieldNode[],
  parentId?: string,
): FieldNode[] {
  if (!parentId) return fn(fields);
  return fields.map((node) =>
    node.id === parentId
      ? { ...node, children: fn(node.children ?? []) }
      : node.children
        ? { ...node, children: mapFields(node.children, fn, parentId) }
        : node,
  );
}

function updateNode(fields: FieldNode[], id: string, next: FieldNode): FieldNode[] {
  return fields.map((node) => {
    if (node.id === id) return next;
    if (node.children) return { ...node, children: updateNode(node.children, id, next) };
    return node;
  });
}

function removeNode(fields: FieldNode[], id: string): { fields: FieldNode[]; removed?: FieldNode } {
  let removed: FieldNode | undefined;
  const next: FieldNode[] = [];
  for (const node of fields) {
    if (node.id === id) {
      removed = node;
      continue;
    }
    if (node.children) {
      const result = removeNode(node.children, id);
      if (result.removed) removed = result.removed;
      next.push({ ...node, children: result.fields });
    } else {
      next.push(node);
    }
  }
  return { fields: next, removed };
}

function contains(node: FieldNode, id: string): boolean {
  return (node.children ?? []).some((child) => child.id === id || contains(child, id));
}

function findNode(fields: FieldNode[], id: string): FieldNode | undefined {
  for (const node of fields) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/** 找到某节点所在的父列表定位（用于同级插入 index 计算）。 */
function insertAt(list: FieldNode[], node: FieldNode, index?: number): FieldNode[] {
  const next = [...list];
  const at = index === undefined ? next.length : Math.max(0, Math.min(index, next.length));
  next.splice(at, 0, node);
  return next;
}

export function reduceModel(draft: ModelDraft, action: ModelAction): ModelDraft {
  switch (action.type) {
    case "replace":
      return action.draft;
    case "meta.update":
      return { ...draft, ...action.patch };
    case "groups.replace":
      return { ...draft, groups: action.groups };
    case "field.update":
      return { ...draft, fields: updateNode(draft.fields, action.id, action.node) };
    case "field.remove":
      return { ...draft, fields: removeNode(draft.fields, action.id).fields };
    case "field.add":
      return {
        ...draft,
        fields: mapFields(
          draft.fields,
          (list) => insertAt(list, action.node, action.index),
          action.parentId,
        ),
      };
    case "field.duplicate": {
      // 插入到源节点之后（同级）。
      const parent = findParentId(draft.fields, action.id);
      return {
        ...draft,
        fields: mapFields(
          draft.fields,
          (list) => {
            const index = list.findIndex((node) => node.id === action.id);
            return insertAt(list, action.node, index < 0 ? undefined : index + 1);
          },
          parent,
        ),
      };
    }
    case "field.move": {
      // 仅同级重排：从原位置移除后按 toIndex 插入目标父列表。
      const target = action.parentId;
      const source = findNode(draft.fields, action.id);
      if (!source) return draft;
      if (target && (target === action.id || contains(source, target))) return draft;
      const { fields, removed } = removeNode(draft.fields, action.id);
      if (!removed) return draft;
      return {
        ...draft,
        fields: mapFields(fields, (list) => insertAt(list, removed, action.toIndex), target),
      };
    }
    default:
      return draft;
  }
}

function findParentId(fields: FieldNode[], id: string, parent?: string): string | undefined {
  for (const node of fields) {
    if (node.id === id) return parent;
    if (node.children) {
      const found = findParentId(node.children, id, node.id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export { findNode, findParentId };
