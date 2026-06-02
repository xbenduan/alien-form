import type { DetailItem } from '../internal/types';

export function projectDetailItems(schema: any): DetailItem[] {
  const properties: Record<string, any> = schema?.properties ?? {};
  let order = 0;

  return Object.entries(properties)
    .filter(([_, field]) => field['x-cms']?.detail?.visible !== false)
    .map(([key, field]) => ({
      key,
      title: field.title ?? key,
      format: field['x-cms']?.detail?.format,
      dataSource: field.dataSource,
      order: order++,
    }));
}
