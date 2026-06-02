import type { FilterField } from '../internal/types';

export function projectFilterFields(schema: any): FilterField[] {
  const properties: Record<string, any> = schema?.properties ?? {};
  let order = 0;

  return Object.entries(properties)
    .filter(([_, field]) => field['x-cms']?.filter?.visible !== false)
    .map(([key, field]) => ({
      key,
      title: field.title ?? key,
      component: field.component,
      operator: field['x-cms']?.filter?.operator ?? 'contains',
      props: field.props,
      dataSource: field.dataSource,
      defaultVisible: field['x-cms']?.filter?.defaultVisible ?? false,
      order: order++,
    }));
}
