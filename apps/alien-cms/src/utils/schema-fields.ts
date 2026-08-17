import type { CmsFieldSchema, CmsModelSchema } from "../domains/model";

export interface SchemaLeafField {
  key: string;
  path: string;
  field: CmsFieldSchema;
}

function getChildren(field: CmsFieldSchema) {
  if (field.type === "array" && field.items && !Array.isArray(field.items)) {
    return field.items.properties;
  }
  return field.properties;
}

export function isComplexField(field: CmsFieldSchema) {
  return field.type === "object" || field.type === "array" || Boolean(field["x-layout"]);
}

export function collectLeafFields(schema?: CmsModelSchema): SchemaLeafField[] {
  const result: SchemaLeafField[] = [];

  function visit(path: string[], field: CmsFieldSchema) {
    const children = getChildren(field);
    if (isComplexField(field) && children) {
      Object.entries(children).forEach(([key, child]) => visit([...path, key], child));
      return;
    }
    result.push({
      key: path.join("."),
      path: path.join("."),
      field,
    });
  }

  Object.entries(schema?.properties ?? {}).forEach(([key, field]) => visit([key], field));
  return result;
}

export function readPathValue(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}
