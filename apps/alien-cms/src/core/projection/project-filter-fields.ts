import type { CmsModelSchema, FilterFieldProjection } from '../../types/model';
import { sortSchemaEntries } from './shared';

export function projectFilterFields(schema: CmsModelSchema): FilterFieldProjection[] {
  const defaultVisibleCount = schema['x-model']?.defaultFilterCount ?? 3;
  let visibleIndex = 0;

  return sortSchemaEntries(schema.properties).flatMap(([key, field]) => {
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
}
