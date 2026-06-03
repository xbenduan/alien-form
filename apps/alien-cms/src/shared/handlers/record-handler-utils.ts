import type { DataSourceItem, RuntimeRuleHandler } from '@alien-form/core';
import { getRecord, getSchema, listRecords } from '@alien-form/cms';
import type { CmsFieldSchema, CmsModelSchema, ModelRecord } from '../../domains/record/types/record';

export type HandlerValueSource =
  | unknown
  | {
      selector?: string;
      value?: unknown;
    };

export interface RecordFilterConfig {
  field: string;
  operator?: 'eq' | 'includes' | 'intersects';
  selector?: string;
  value?: unknown;
}

export interface ModelRecordOptionsConfig {
  model?: string;
  selector?: string;
  requireSelector?: boolean;
  labelField?: string | string[];
  valueField?: string;
  filters?: RecordFilterConfig[];
}

export interface SchemaFieldOptionsConfig {
  model?: string;
  selector?: string;
  includeTypes?: string[];
  excludeTypes?: string[];
  includeContainers?: boolean;
  valueMode?: 'key' | 'name';
}

export interface RelatedRecordFieldOptionsConfig {
  model: string;
  selector: string;
  sourceField: string;
  labelField?: string;
  valueField?: string;
}

export function getValueByPath(source: unknown, path?: string): unknown {
  if (!path) return source;
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
}

export function resolveValueSource(ctx: Parameters<RuntimeRuleHandler>[0], source: HandlerValueSource) {
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const selector = (source as { selector?: string }).selector;
    if (selector) return ctx.get(selector);
    if ('value' in source) return (source as { value?: unknown }).value;
  }
  return source;
}

export async function loadModelSchema(modelName: string): Promise<CmsModelSchema | undefined> {
  try {
    return (await getSchema(modelName)) as CmsModelSchema;
  } catch {
    return undefined;
  }
}

export async function listModelRecords(modelName: string): Promise<ModelRecord[]> {
  const result = await listRecords({
    model: modelName,
    pagination: { current: 1, pageSize: 500 },
  });
  return result.list;
}

export function toArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export function buildLabel(record: ModelRecord, labelField?: string | string[]) {
  const fields = Array.isArray(labelField)
    ? labelField
    : labelField
      ? [labelField]
      : ['name', 'title', 'employeeName', 'serviceName', 'customerName'];
  const parts = fields
    .map((field) => getValueByPath(record, field))
    .filter((item) => item !== undefined && item !== null && item !== '');
  if (parts.length > 0) {
    return parts.join(' / ');
  }
  return String(record.id ?? '');
}

export function matchesRecordFilter(record: ModelRecord, filter: RecordFilterConfig, ctx: Parameters<RuntimeRuleHandler>[0]) {
  const actual = getValueByPath(record, filter.field);
  const expected = resolveValueSource(ctx, filter.selector ? { selector: filter.selector } : { value: filter.value });
  if (expected === undefined || expected === null || expected === '') {
    return true;
  }
  const operator = filter.operator ?? 'eq';

  if (operator === 'includes') {
    return Array.isArray(actual)
      ? actual.includes(expected)
      : Array.isArray(expected)
        ? expected.includes(actual)
        : false;
  }

  if (operator === 'intersects') {
    const actualList = toArray(actual);
    const expectedList = toArray(expected);
    return actualList.some((item) => expectedList.includes(item));
  }

  return actual === expected;
}

export function toDataSourceItems(items: unknown, labelField?: string, valueField?: string): DataSourceItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (item && typeof item === 'object' && 'label' in item && 'value' in item) {
        return item as DataSourceItem;
      }

      if (item && typeof item === 'object') {
        const label = getValueByPath(item, labelField ?? 'label');
        const value = getValueByPath(item, valueField ?? 'value');
        if (label !== undefined && value !== undefined) {
          return { ...(item as Record<string, unknown>), label: String(label), value };
        }
      }

      return { label: String(item), value: item };
    })
    .filter((item) => item.label !== 'undefined');
}

export function collectSchemaFields(
  fields: Record<string, CmsFieldSchema>,
  options: DataSourceItem[],
  config: SchemaFieldOptionsConfig,
  parentPath?: string,
  parentLabel?: string,
) {
  for (const [fieldKey, field] of Object.entries(fields)) {
    const nextPath = parentPath ? `${parentPath}.${fieldKey}` : fieldKey;
    const nextLabel = parentLabel ? `${parentLabel} / ${field.title ?? fieldKey}` : field.title ?? fieldKey;
    const fieldType = field.type ?? 'string';
    const includeTypes = config.includeTypes;
    const excludeTypes = config.excludeTypes;
    const isContainer = fieldType === 'object' || fieldType === 'array' || fieldType === 'void';
    const includeByType = includeTypes ? includeTypes.includes(fieldType) : true;
    const excludeByType = excludeTypes ? excludeTypes.includes(fieldType) : false;

    if ((!isContainer || config.includeContainers) && includeByType && !excludeByType) {
      options.push({
        label: `${nextLabel} (${nextPath})`,
        value: config.valueMode === 'name' ? nextPath : fieldKey,
      });
    }

    if (field.properties) {
      collectSchemaFields(field.properties as Record<string, CmsFieldSchema>, options, config, nextPath, nextLabel);
    }

    const itemProperties =
      field.items && typeof field.items === 'object' && 'properties' in field.items
        ? (field.items.properties as Record<string, CmsFieldSchema> | undefined)
        : undefined;
    if (itemProperties) {
      collectSchemaFields(itemProperties, options, config, nextPath, nextLabel);
    }
  }
}
