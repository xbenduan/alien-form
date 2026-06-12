import { isSystemField } from "../schema/system-fields";
import { resolveSceneRender } from "./scene-resolver";
import type { AdapterCatalogItem } from "../define/adapters";

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
export function projectFilterFields(schema: any, catalog?: AdapterCatalogItem[]) {
  const properties: Record<string, any> = schema?.properties ?? {};
  const result: ProjectedFilterField[] = [];
  const counter = { value: 0 };

  function visit(pathSegments: string[], field: any) {
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
          visit([...pathSegments, childKey], childField);
        }
      }
      return;
    }

    const path = pathSegments.join(".");
    const key = pathSegments.length > 1 ? `$root.${path}` : path;
    const lastSegment = pathSegments[pathSegments.length - 1];
    const title = field?.title ?? lastSegment;

    const resolved = catalog ? resolveSceneRender(field, "recordFilter", catalog) : undefined;

    const fallbackProps: Record<string, unknown> = {
      ...(field?.props as Record<string, unknown> | undefined),
      ...(field?.["x-cms"]?.filter?.props as Record<string, unknown> | undefined),
    };
    const mergedProps: Record<string, unknown> = resolved?.props ?? fallbackProps;
    if (mergedProps.placeholder === undefined) {
      mergedProps.placeholder = `请输入${title}`;
    }

    const component =
      resolved?.componentKey ?? (field?.component as string | undefined);
    const operator =
      resolved?.operator ?? (field?.["x-cms"]?.filter?.operator ?? "contains");

    result.push({
      key,
      path,
      title,
      component,
      operator: operator as string,
      props: mergedProps,
      dataSource: field?.dataSource as Array<{ label: string; value: unknown }> | undefined,
      defaultVisible: (field?.["x-cms"]?.filter?.defaultVisible ?? false) as boolean,
      order: counter.value++,
    });
  }

  for (const [topKey, topField] of Object.entries(properties)) {
    // Top-level system fields exclude the whole subtree.
    if (isSystemField(topKey)) continue;
    visit([topKey], topField);
  }

  return result;
}
