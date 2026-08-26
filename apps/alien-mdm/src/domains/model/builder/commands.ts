import type { CommandMap } from "@alien-form/builder";
import type { FieldDraft, GroupDraft, ModelDraft } from "./types";

export interface FieldAddPayload {
  field: FieldDraft;
  parentId?: string;
  index?: number;
}

export interface FieldMovePayload {
  id: string;
  parentId?: string;
  targetId?: string;
  index?: number;
}

interface RemovedField {
  fields: FieldDraft[];
  field?: FieldDraft;
}

function updateField(
  fields: FieldDraft[],
  id: string,
  update: (field: FieldDraft) => FieldDraft,
): FieldDraft[] {
  return fields.map((field) => {
    if (field.id === id) return update(field);
    return field.children
      ? { ...field, children: updateField(field.children, id, update) }
      : field;
  });
}

function removeField(fields: FieldDraft[], id: string): RemovedField {
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (field.id === id) {
      return {
        fields: [...fields.slice(0, index), ...fields.slice(index + 1)],
        field,
      };
    }
    const nested = removeField(field.children ?? [], id);
    if (nested.field) {
      return {
        fields: fields.map((item) =>
          item.id === field.id ? { ...item, children: nested.fields } : item,
        ),
        field: nested.field,
      };
    }
  }
  return { fields };
}

function containsField(field: FieldDraft, id: string): boolean {
  return field.id === id || Boolean(field.children?.some((child) => containsField(child, id)));
}

function hasField(fields: FieldDraft[], id: string): boolean {
  return fields.some((field) => containsField(field, id));
}

function insertAt<T>(items: T[], item: T, index?: number): T[] {
  const position = Math.min(items.length, Math.max(0, index ?? items.length));
  return [...items.slice(0, position), item, ...items.slice(position)];
}

function insertBefore(fields: FieldDraft[], targetId: string, field: FieldDraft): FieldDraft[] {
  const index = fields.findIndex((item) => item.id === targetId);
  if (index >= 0) return insertAt(fields, field, index);
  return fields.map((item) =>
    item.children ? { ...item, children: insertBefore(item.children, targetId, field) } : item,
  );
}

function insertInto(
  fields: FieldDraft[],
  parentId: string,
  field: FieldDraft,
  index?: number,
): FieldDraft[] {
  return updateField(fields, parentId, (parent) => ({
    ...parent,
    children: insertAt(parent.children ?? [], field, index),
  }));
}

export const modelCommands: CommandMap<ModelDraft> = {
  "field.add": (document, payload: FieldAddPayload) => ({
    ...document,
    fields: payload.parentId
      ? insertInto(document.fields, payload.parentId, payload.field, payload.index)
      : insertAt(document.fields, payload.field, payload.index),
  }),
  "field.update": (document, payload: { id: string; field: FieldDraft }) => ({
    ...document,
    fields: updateField(document.fields, payload.id, () => payload.field),
  }),
  "field.remove": (document, payload: { id: string }) => ({
    ...document,
    fields: removeField(document.fields, payload.id).fields,
  }),
  "field.move": (document, payload: FieldMovePayload) => {
    if (payload.parentId && !hasField(document.fields, payload.parentId)) return document;
    if (payload.targetId && !hasField(document.fields, payload.targetId)) return document;
    const removed = removeField(document.fields, payload.id);
    if (!removed.field) return document;
    if (
      (payload.parentId && containsField(removed.field, payload.parentId)) ||
      (payload.targetId && containsField(removed.field, payload.targetId))
    ) {
      return document;
    }
    const fields = payload.targetId
      ? insertBefore(removed.fields, payload.targetId, removed.field)
      : payload.parentId
        ? insertInto(removed.fields, payload.parentId, removed.field, payload.index)
        : insertAt(removed.fields, removed.field, payload.index);
    return { ...document, fields };
  },
  "group.add": (document, payload: { group: GroupDraft; index?: number }) => ({
    ...document,
    groups: insertAt(document.groups, payload.group, payload.index),
  }),
  "group.update": (document, payload: { id: string; group: GroupDraft }) => ({
    ...document,
    groups: document.groups.map((group) => (group.id === payload.id ? payload.group : group)),
  }),
  "group.remove": (document, payload: { id: string }) => ({
    ...document,
    groups: document.groups.filter((group) => group.id !== payload.id),
  }),
  "group.move": (document, payload: { from: number; to: number }) => {
    const groups = [...document.groups];
    const [group] = groups.splice(payload.from, 1);
    if (!group) return document;
    groups.splice(Math.min(groups.length, Math.max(0, payload.to)), 0, group);
    return { ...document, groups };
  },
  "meta.update": (document, payload: Partial<Omit<ModelDraft, "fields" | "groups" | "layout">>) => ({
    ...document,
    ...payload,
  }),
  "groups.replace": (document, payload: GroupDraft[]) => ({ ...document, groups: payload }),
  "layout.update": (document, payload: ModelDraft["layout"]) => ({ ...document, layout: payload }),
};
