import {
  SYSTEM_DETAIL_GROUP,
  SYSTEM_FIELD_FORM,
  SYSTEM_FIELD_KEYS,
  type FieldGroup,
} from "@alien-form/protocol";

export { SYSTEM_DETAIL_GROUP, SYSTEM_FIELD_FORM, SYSTEM_FIELD_KEYS };

/** Returns whether a page group is the generated system-information group. */
export function isSystemDetailGroup(group: FieldGroup): boolean {
  return (
    group.keys.length === SYSTEM_FIELD_KEYS.length &&
    SYSTEM_FIELD_KEYS.every((key) => group.keys.includes(key))
  );
}
