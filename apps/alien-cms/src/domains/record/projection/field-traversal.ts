import type {
  CmsFieldSchema,
  CmsModelSchema,
} from "../../model";

export interface FieldVisit {
  field: CmsFieldSchema;
  key: string;
  path: string;
  pathSegments: string[];
  topLevel: boolean;
}

export function getObjectArrayItem(
  field: CmsFieldSchema,
): CmsFieldSchema | undefined {
  if (field.type !== "array" || !field.items || Array.isArray(field.items)) {
    return undefined;
  }

  return field.items.type === "object" && field.items.properties
    ? field.items
    : undefined;
}

export function getChildProperties(
  field: CmsFieldSchema,
): Record<string, CmsFieldSchema> | undefined {
  const objectArrayItem = getObjectArrayItem(field);
  if (objectArrayItem) {
    return objectArrayItem.properties;
  }

  if (field["x-layout"] || field.type === "object") {
    return field.properties;
  }

  return undefined;
}

export function isContainerField(field: CmsFieldSchema): boolean {
  return Boolean(getChildProperties(field));
}

export function withoutCmsMetadata(field: CmsFieldSchema): CmsFieldSchema {
  const { "x-cms": _cms, ...fieldSchema } = field;
  const projected: CmsFieldSchema = { ...fieldSchema };

  if (field.properties) {
    projected.properties = Object.fromEntries(
      Object.entries(field.properties).map(([key, child]) => [
        key,
        withoutCmsMetadata(child),
      ]),
    );
  }

  if (field.items && !Array.isArray(field.items)) {
    projected.items = withoutCmsMetadata(field.items);
  }

  return projected;
}

export function visitSchemaFields(
  schema: CmsModelSchema | undefined,
  visitor: (visit: FieldVisit) => void | boolean,
): void {
  function visitEntries(
    properties: Record<string, CmsFieldSchema>,
    parentSegments: string[],
  ) {
    for (const [key, field] of Object.entries(properties)) {
      const pathSegments = [...parentSegments, key];
      const shouldVisitChildren =
        visitor({
          field,
          key,
          path: pathSegments.join("."),
          pathSegments,
          topLevel: parentSegments.length === 0,
        }) !== false;

      const children = getChildProperties(field);
      if (shouldVisitChildren && children) {
        visitEntries(children, pathSegments);
      }
    }
  }

  visitEntries(schema?.properties ?? {}, []);
}

export function getFieldByPath(
  schema: CmsModelSchema | undefined,
  path: string,
): CmsFieldSchema | undefined {
  let result: CmsFieldSchema | undefined;
  visitSchemaFields(schema, (visit) => {
    if (visit.path === path) {
      result = visit.field;
      return false;
    }
    return result === undefined;
  });
  return result;
}

export function toSafeFieldKey(key: string): string {
  return key.replace(/^\$root\./, "").replace(/\./g, "__");
}
