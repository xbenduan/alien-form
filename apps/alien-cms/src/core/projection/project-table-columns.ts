import type { CmsModelSchema, TableColumnProjection } from '../../types/model';
import { sortSchemaEntries } from './shared';

export function projectTableColumns(schema: CmsModelSchema): TableColumnProjection[] {
  return sortSchemaEntries(schema.properties).flatMap(([key, field]) => {
    if (!field['x-cms']?.table?.visible) {
      return [];
    }

    return [
      {
        key,
        title: field.title ?? key,
        width: field['x-cms']?.table?.width,
        ellipsis: field['x-cms']?.table?.ellipsis,
        format: field['x-cms']?.table?.format,
        dataSource: field.dataSource,
        type: field.type,
        order: field.order ?? 0,
      },
    ];
  });
}
