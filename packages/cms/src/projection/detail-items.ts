/**
 * Project a CMS model schema into detail view item definitions.
 */
export function projectDetailItems(schema: any) {
  const properties: Record<string, any> = schema?.properties ?? {};
  let order = 0;

  return Object.entries(properties)
    .filter(([_, field]) => field['x-cms']?.detail?.visible !== false)
    .map(([key, field]) => ({
      key,
      title: field.title ?? key,
      format: field['x-cms']?.detail?.format as string | undefined,
      dataSource: field.dataSource as Array<{ label: string; value: unknown }> | undefined,
      order: order++,
    }));
}
