import type { TableColumn } from '../internal/types';

export function projectTableColumns(schema: any): TableColumn[] {
  const properties: Record<string, any> = schema?.properties ?? {};
  let order = 0;

  return Object.entries(properties)
    .filter(([_, field]) => field['x-cms']?.table?.visible !== false)
    .map(([key, field]) => ({
      key,
      title: field.title ?? key,
      width: field['x-cms']?.table?.width,
      ellipsis: field['x-cms']?.table?.ellipsis ?? true,
      format: field['x-cms']?.table?.format,
      dataSource: field.dataSource,
      inline: field['x-cms']?.table?.inline,
      expandable: field['x-cms']?.table?.expandable,
      order: order++,
    }));
}
