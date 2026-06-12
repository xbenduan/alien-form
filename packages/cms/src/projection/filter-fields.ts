import { isSystemField } from "../schema/system-fields";

interface ProjectedFilterField {
  key: string;
  path: string;
  title: string;
  component: string | undefined;
  operator: string;
  props: Record<string, unknown> | undefined;
  dataSource: Array<{ label: string; value: unknown }> | undefined;
  defaultVisible: boolean;
  order: number;
}

function isLeafField(field: any): boolean {
  const type = field?.type;
  if ((type === "object" || type === "void") && field?.properties) {
    return false;
  }
  if (type === "array") {
    const items = field?.items;
    if (items && !Array.isArray(items) && items.type === "object" && items.properties) {
      return false;
    }
  }
  return true;
}

/**
 * Project a CMS model schema into a flat list of atomic (leaf) filter fields.
 *
 * Nested leaf fields are exposed with a `$root.<path>` key while their real
 * dot-path is kept on `path` for submission restoration.
 */
export function projectFilterFields(schema: any) {
  const properties: Record<string, any> = schema?.properties ?? {};
  const result: ProjectedFilterField[] = [];
  const counter = { value: 0 };

  for (const [topKey, topField] of Object.entries(properties)) {
    // Top-level system fields exclude the whole subtree.
    if (isSystemField(topKey)) continue;
    visit([topKey], topField, result, counter);
  }

  return result;
}

function visit(
  pathSegments: string[],
  field: any,
  result: ProjectedFilterField[],
  counter: { value: number },
) {
  if (field?.display === "none") return;
  if (field?.["x-cms"]?.filter?.visible === false) return;

  if (!isLeafField(field)) {
    const type = field?.type;
    const nestedProperties: Record<string, any> | undefined =
      type === "array"
        ? field?.items?.properties
        : field?.properties;

    if (nestedProperties) {
      for (const [childKey, childField] of Object.entries(nestedProperties)) {
        visit([...pathSegments, childKey], childField, result, counter);
      }
    }
    return;
  }

  const path = pathSegments.join(".");
  const key = pathSegments.length > 1 ? `$root.${path}` : path;
  const lastSegment = pathSegments[pathSegments.length - 1];
  const title = field?.title ?? lastSegment;

  const mergedProps: Record<string, unknown> = {
    ...(field?.props as Record<string, unknown> | undefined),
    ...(field?.["x-cms"]?.filter?.props as Record<string, unknown> | undefined),
  };
  if (mergedProps.placeholder === undefined) {
    mergedProps.placeholder = `请输入${title}`;
  }

  result.push({
    key,
    path,
    title,
    component: field?.component as string | undefined,
    operator: (field?.["x-cms"]?.filter?.operator ?? "contains") as string,
    props: mergedProps,
    dataSource: field?.dataSource as Array<{ label: string; value: unknown }> | undefined,
    defaultVisible: (field?.["x-cms"]?.filter?.defaultVisible ?? false) as boolean,
    order: counter.value++,
  });
}
