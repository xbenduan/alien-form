/**
 * Projects a CMS model schema into a form-only schema for add/edit mode.
 * Strips table/filter/detail meta, keeps only form-relevant fields.
 */
export function projectFormSchema(schema: any, mode: 'add' | 'edit'): any {
  if (!schema?.properties) return undefined;

  const properties: Record<string, any> = {};

  for (const [key, field] of Object.entries<any>(schema.properties)) {
    const formMeta = field['x-cms']?.form;

    // Skip fields not applicable to this mode
    if (formMeta?.modes && !formMeta.modes.includes(mode)) continue;

    // Clone field without x-cms (form doesn't need it)
    const { 'x-cms': _, ...cleanField } = field;
    properties[key] = cleanField;
  }

  return {
    type: 'object',
    properties,
  };
}
