import type { CmsFieldSchema, CmsModelSchema } from '../../types/model';

function getDefaultComponent(field: CmsFieldSchema): string {
  if (field.component) {
    return field.component;
  }

  if (field.type === 'number') {
    return 'NumberInput';
  }

  if (field.type === 'boolean') {
    return 'Switch';
  }

  if (field.type === 'array') {
    return 'TagsInput';
  }

  return 'Input';
}

function normalizeField(key: string, field: CmsFieldSchema): CmsFieldSchema {
  const normalized: CmsFieldSchema = {
    ...field,
    title: field.title ?? key,
    component: getDefaultComponent(field),
    decorator: field.decorator ?? (field.type === 'object' || field.type === 'void' ? field.decorator : 'FormItem'),
    order: field.order ?? 0,
    props: field.props ?? {},
    'x-cms': {
      ...field['x-cms'],
      filter: {
        visible: field['x-cms']?.filter?.visible ?? false,
        defaultVisible: field['x-cms']?.filter?.defaultVisible,
        operator: field['x-cms']?.filter?.operator ?? (field.type === 'string' ? 'contains' : 'eq'),
      },
      table: {
        visible: field['x-cms']?.table?.visible ?? false,
        width: field['x-cms']?.table?.width,
        ellipsis: field['x-cms']?.table?.ellipsis,
        format: field['x-cms']?.table?.format,
        inline: field['x-cms']?.table?.inline,
        expandable: field['x-cms']?.table?.expandable,
      },
      form: {
        modes: field['x-cms']?.form?.modes,
      },
      detail: {
        visible: field['x-cms']?.detail?.visible ?? true,
        format: field['x-cms']?.detail?.format ?? field['x-cms']?.table?.format,
      },
    },
  };

  // 递归处理嵌套 properties（object/void 类型）
  if (normalized.properties) {
    const nestedProperties: Record<string, CmsFieldSchema> = {};
    for (const [nestedKey, nestedField] of Object.entries(normalized.properties)) {
      nestedProperties[nestedKey] = normalizeField(nestedKey, nestedField as CmsFieldSchema);
    }
    normalized.properties = nestedProperties;
  }

  // 递归处理 array items 的 properties
  if (normalized.items && typeof normalized.items === 'object' && 'properties' in normalized.items) {
    const items = normalized.items as { type?: string; properties?: Record<string, CmsFieldSchema> };
    if (items.properties) {
      const itemProperties: Record<string, CmsFieldSchema> = {};
      for (const [itemKey, itemField] of Object.entries(items.properties)) {
        itemProperties[itemKey] = normalizeField(itemKey, itemField);
      }
      normalized.items = { ...items, properties: itemProperties };
    }
  }

  return normalized;
}

export function normalizeSchema(rawSchema: CmsModelSchema): CmsModelSchema {
  const properties = rawSchema.properties ?? {};
  const normalizedProperties: Record<string, CmsFieldSchema> = {};

  for (const [key, field] of Object.entries(properties)) {
    normalizedProperties[key] = normalizeField(key, field);
  }

  return {
    ...rawSchema,
    properties: normalizedProperties,
    'x-model': {
      name: rawSchema['x-model']?.name ?? 'unknown',
      title: rawSchema['x-model']?.title ?? rawSchema.title ?? '模型工作台',
      subtitle: rawSchema['x-model']?.subtitle ?? rawSchema['x-model']?.name,
      description: rawSchema['x-model']?.description ?? rawSchema.description,
      singularLabel: rawSchema['x-model']?.singularLabel ?? '记录',
      pluralLabel: rawSchema['x-model']?.pluralLabel ?? '记录',
      primaryField: rawSchema['x-model']?.primaryField ?? 'id',
      defaultFilterCount: rawSchema['x-model']?.defaultFilterCount ?? 3,
      defaultPageSize: rawSchema['x-model']?.defaultPageSize ?? 10,
      openMode: {
        add: rawSchema['x-model']?.openMode?.add ?? 'drawer',
        edit: rawSchema['x-model']?.openMode?.edit ?? 'drawer',
        detail: rawSchema['x-model']?.openMode?.detail ?? 'drawer',
      },
    },
  };
}
