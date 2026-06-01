import type { CmsModelSchema, FilterFieldProjection } from '../../types/model';
import { sortSchemaEntries } from './shared';

export function projectFilterFields(schema: CmsModelSchema): FilterFieldProjection[] {
  const entries = sortSchemaEntries(schema.properties);
  const defaultVisibleCount = schema['x-model']?.defaultFilterCount ?? 3;
  let visibleIndex = 0;

  const configuredFilters = entries.flatMap(([key, field]) => {
    if (!field['x-cms']?.filter?.visible) {
      return [];
    }

    const projection: FilterFieldProjection = {
      key,
      title: field.title ?? key,
      type: field.type,
      component: field.component,
      operator: field['x-cms']?.filter?.operator ?? 'eq',
      props: field.props,
      dataSource: field.dataSource,
      defaultVisible:
        field['x-cms']?.filter?.defaultVisible ?? visibleIndex < defaultVisibleCount,
      order: field.order ?? 0,
    };

    visibleIndex += 1;
    return [projection];
  });

  if (configuredFilters.length > 0) {
    return configuredFilters;
  }

  return entries
    .filter(([, field]) => field.type !== 'object' && field.type !== 'void')
    .slice(0, defaultVisibleCount)
    .map(([key, field], index) => ({
      key,
      title: field.title ?? key,
      type: field.type,
      component: field.component,
      operator: field.type === 'string' ? 'contains' : 'eq',
      props: field.props,
      dataSource: field.dataSource,
      defaultVisible: index < defaultVisibleCount,
      order: field.order ?? 0,
    }));
}
