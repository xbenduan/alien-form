/**
 * Project a CMS model schema into filter field definitions.
 */
export function projectFilterFields(schema: any) {
  const properties: Record<string, any> = schema?.properties ?? {};
  let order = 0;

  return Object.entries(properties)
    .filter(([_, field]) => field['x-cms']?.filter?.visible !== false)
    .map(([key, field]) => ({
      key,
      title: field.title ?? key,
      component: field.component as string | undefined,
      operator: (field['x-cms']?.filter?.operator ?? 'contains') as string,
      props: field.props as Record<string, unknown> | undefined,
      dataSource: field.dataSource as Array<{ label: string; value: unknown }> | undefined,
      defaultVisible: (field['x-cms']?.filter?.defaultVisible ?? false) as boolean,
      order: order++,
    }));
}
