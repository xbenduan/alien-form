import type { FieldGroup, FieldSchema } from "@alien-form/protocol";

/** Field keys managed by the runtime rather than record forms. */
export const SYSTEM_FIELD_KEYS = ["id", "createdAt", "updatedAt"] as const;

/** Shared form behavior for generated system fields. */
export const SYSTEM_FIELD_FORM: Pick<FieldSchema, "disabled" | "display"> = {
  display: "{{ mode === 'detail' ? 'visible' : 'none' }}",
  disabled: true,
};

/** Shared detail-page group for generated system fields. */
export const SYSTEM_DETAIL_GROUP: FieldGroup = {
  component: "ObjectField",
  title: "系统信息",
  keys: [...SYSTEM_FIELD_KEYS],
  props: { gridSpan: 12 },
};

/** Returns whether a page group is the generated system-information group. */
export function isSystemDetailGroup(group: FieldGroup): boolean {
  return (
    group.keys.length === SYSTEM_FIELD_KEYS.length &&
    SYSTEM_FIELD_KEYS.every((key) => group.keys.includes(key))
  );
}
