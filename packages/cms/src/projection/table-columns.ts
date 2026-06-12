import { isSystemField } from "../schema/system-fields";

/**
 * Project a CMS model schema into table column definitions.
 *
 * Visibility is no longer filtered at the projection stage — all top-level
 * fields are kept as columns. Consumers / column settings decide what to show.
 */
export function projectTableColumns(schema: any) {
  const properties: Record<string, any> = schema?.properties ?? {};
  let order = 0;

  return Object.entries(properties)
    .map(([key, field]) => {
      const visible = field['x-cms']?.table?.visible as boolean | undefined;
      const defaultVisible =
        typeof visible === 'boolean' ? visible : !isSystemField(key);

      return {
        key,
        title: field.title ?? key,
        width: field['x-cms']?.table?.width as number | undefined,
        ellipsis: (field['x-cms']?.table?.ellipsis ?? true) as boolean,
        format: field['x-cms']?.table?.format as string | undefined,
        dataSource: field.dataSource as Array<{ label: string; value: unknown }> | undefined,
        inline: field['x-cms']?.table?.inline as string[] | undefined,
        expandable: field['x-cms']?.table?.expandable as boolean | undefined,
        visible,
        defaultVisible,
        order: (field['x-cms']?.table?.order ?? field.order ?? order++) as number,
      };
    })
    .sort((left, right) => left.order - right.order);
}
