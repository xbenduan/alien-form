/**
 * Project a CMS model schema into table column definitions.
 */
export function projectTableColumns(schema: any) {
  const properties: Record<string, any> = schema?.properties ?? {};
  let order = 0;

  return Object.entries(properties)
    .filter(([_, field]) => field['x-cms']?.table?.visible !== false)
    .map(([key, field]) => ({
      key,
      title: field.title ?? key,
      width: field['x-cms']?.table?.width as number | undefined,
      ellipsis: (field['x-cms']?.table?.ellipsis ?? true) as boolean,
      format: field['x-cms']?.table?.format as string | undefined,
      dataSource: field.dataSource as Array<{ label: string; value: unknown }> | undefined,
      inline: field['x-cms']?.table?.inline as string[] | undefined,
      expandable: field['x-cms']?.table?.expandable as boolean | undefined,
      order: order++,
    }));
}
