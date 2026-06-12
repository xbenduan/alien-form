const SYSTEM_FIELD_KEYS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "createdBy",
  "updatedBy",
]);

export function isSystemField(key: string): boolean {
  return SYSTEM_FIELD_KEYS.has(key);
}
