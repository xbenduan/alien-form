import type { CmsFieldSchema, CmsModelSchema } from '../../types/model';
import { sortSchemaEntries } from './shared';

function getDetailComponent(field: CmsFieldSchema): string {
  const format = field['x-cms']?.detail?.format;

  if (format === 'status') return 'DetailStatus';
  if (format === 'date') return 'DetailDate';
  if (format === 'dateTime') return 'DetailDateTime';
  if (format === 'boolean' || field.type === 'boolean') return 'DetailBoolean';
  if (field.type === 'array') return field.component === 'ArrayCards' ? 'ArrayCards' : 'DetailArrayText';
  if (field.type === 'void' || field.type === 'object') return field.component ?? 'SectionCard';
  return 'DetailText';
}

export function projectDetailField(field: CmsFieldSchema): CmsFieldSchema {
  const nextField: CmsFieldSchema = {
    ...field,
    component: getDetailComponent(field),
    decorator: field.type === 'void' ? field.decorator : 'FormItem',
    props: {
      ...(field.props ?? {}),
      disabled: true,
      readOnly: true,
    },
  };

  if (field.type === 'array') {
    nextField.props = {
      ...nextField.props,
      disabled: true,
    };
    if (field.items && !Array.isArray(field.items) && field.items.type === 'object' && field.items.properties) {
      nextField.items = {
        ...field.items,
        properties: Object.fromEntries(
          sortSchemaEntries(field.items.properties as Record<string, CmsFieldSchema>).map(([key, child]) => [
            key,
            projectDetailField(child),
          ]),
        ),
      };
    }
    return nextField;
  }

  if ((field.type === 'object' || field.type === 'void') && field.properties) {
    nextField.properties = Object.fromEntries(
      sortSchemaEntries(field.properties as Record<string, CmsFieldSchema>)
        .filter(([, child]) => child['x-cms']?.detail?.visible !== false)
        .map(([key, child]) => [key, projectDetailField(child)]),
    );
  }

  return nextField;
}

export function projectFieldDetailSchema(key: string, field: CmsFieldSchema): CmsModelSchema {
  const detailField = projectDetailField(field);

  return {
    type: 'object',
    properties: {
      [key]: {
        ...detailField,
        title: undefined,
      },
    },
  };
}

export function projectDetailSchema(schema: CmsModelSchema): CmsModelSchema {
  return {
    ...schema,
    properties: Object.fromEntries(
      sortSchemaEntries(schema.properties as Record<string, CmsFieldSchema>)
        .filter(([, field]) => field['x-cms']?.detail?.visible !== false)
        .map(([key, field]) => [key, projectDetailField(field)]),
    ),
  };
}
