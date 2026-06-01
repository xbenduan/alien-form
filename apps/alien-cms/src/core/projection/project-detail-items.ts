import type { CmsModelSchema, DetailItemProjection } from '../../types/model';
import { sortSchemaEntries } from './shared';

export function projectDetailItems(schema: CmsModelSchema): DetailItemProjection[] {
  return sortSchemaEntries(schema.properties).flatMap(([key, field]) => {
    if (field['x-cms']?.detail?.visible === false) {
      return [];
    }

    return [
      {
        key,
        title: field.title ?? key,
        format: field['x-cms']?.detail?.format,
        dataSource: field.dataSource,
        type: field.type,
        order: field.order ?? 0,
      },
    ];
  });
}
