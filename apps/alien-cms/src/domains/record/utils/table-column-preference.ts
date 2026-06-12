import { isSystemField } from '@alien-form/cms';
import type { CmsModelSchema } from '../types/record';

const TABLE_VISIBLE_KEY_PREFIX = 'alien-cms:table-visible:';

function getStorageKey(modelName: string) {
  return `${TABLE_VISIBLE_KEY_PREFIX}${modelName}`;
}

function getSchemaFieldKeys(schema?: CmsModelSchema) {
  return Object.keys(schema?.properties ?? {});
}

export function getDefaultVisibleKeys(schema?: CmsModelSchema) {
  const schemaVisibleKeys = schema?.['x-model']?.table?.visible;
  if (Array.isArray(schemaVisibleKeys) && schemaVisibleKeys.length > 0) {
    return schemaVisibleKeys.filter((key) => getSchemaFieldKeys(schema).includes(key));
  }

  return getSchemaFieldKeys(schema).filter((key) => !isSystemField(key));
}

export function sanitizeVisibleKeys(schema: CmsModelSchema | undefined, visibleKeys?: string[]) {
  const validKeys = new Set(getSchemaFieldKeys(schema));
  return (visibleKeys ?? []).filter((key) => validKeys.has(key));
}

export function readTableVisibleKeys(modelName: string, schema?: CmsModelSchema) {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const raw = window.localStorage.getItem(getStorageKey(modelName));
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return undefined;
    }

    const sanitized = sanitizeVisibleKeys(schema, parsed.filter((item): item is string => typeof item === 'string'));
    return sanitized.length > 0 ? sanitized : [];
  } catch {
    return undefined;
  }
}

export function writeTableVisibleKeys(modelName: string, schema: CmsModelSchema | undefined, visibleKeys: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const sanitized = sanitizeVisibleKeys(schema, visibleKeys);
  window.localStorage.setItem(getStorageKey(modelName), JSON.stringify(sanitized));
}

export function clearTableVisibleKeys(modelName: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(getStorageKey(modelName));
}
