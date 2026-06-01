import type { CmsModelSchema } from '../../types/model';
import { canUseInMode, sortSchemaEntries } from './shared';

export function projectFormSchema(
  schema: CmsModelSchema,
  mode: 'add' | 'edit',
): CmsModelSchema {
  const properties = Object.fromEntries(
    sortSchemaEntries(schema.properties)
      .filter(([, field]) => canUseInMode(field, mode))
      .map(([key, field]) => [key, field]),
  );

  return {
    ...schema,
    properties,
  };
}
