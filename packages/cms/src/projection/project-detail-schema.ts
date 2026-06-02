import type { CmsFieldSchema, CmsModelSchema } from "../types/schema";
import { sortSchemaEntries } from "./shared";

function getDetailComponent(field: CmsFieldSchema): string {
  if (field.type === "array") {
    if (field.component === "ArrayCards") return "ArrayCards";
    if (field.component === "Select" && field.props?.mode === "tags") return "TagsInput";
    return field.component ?? "TagsInput";
  }
  if (field.type === "void" || field.type === "object") return field.component ?? "SectionCard";
  if (field.component) return field.component;
  if (field.type === "number") return "NumberInput";
  if (field.type === "boolean") return "Switch";
  return "Input";
}

export function projectDetailField(field: CmsFieldSchema): CmsFieldSchema {
  const format = field["x-cms"]?.detail?.format ?? field["x-cms"]?.table?.format;
  const nextField: CmsFieldSchema = {
    ...field,
    component: getDetailComponent(field),
    decorator: field.type === "void" ? field.decorator : "FormItem",
    props: {
      ...(field.props ?? {}),
      format,
      disabled: true,
      readOnly: true,
    },
  };

  if (field.type === "array") {
    nextField.props = { ...nextField.props, disabled: true };
    if (field.items && !Array.isArray(field.items) && field.items.type === "object" && field.items.properties) {
      nextField.items = {
        ...field.items,
        properties: Object.fromEntries(
          sortSchemaEntries(field.items.properties as Record<string, CmsFieldSchema>).map(
            ([key, child]) => [key, projectDetailField(child)],
          ),
        ),
      };
    }
    return nextField;
  }

  if ((field.type === "object" || field.type === "void") && field.properties) {
    nextField.properties = Object.fromEntries(
      sortSchemaEntries(field.properties as Record<string, CmsFieldSchema>)
        .map(([key, child]) => [key, projectDetailField(child)]),
    );
  }

  return nextField;
}

export function projectFieldDetailSchema(key: string, field: CmsFieldSchema): CmsModelSchema {
  const detailField = projectDetailField(field);
  return {
    type: "object",
    properties: {
      [key]: { ...detailField, title: undefined },
    },
  };
}

export function projectDetailSchema(schema: CmsModelSchema): CmsModelSchema {
  return {
    ...schema,
    properties: Object.fromEntries(
      sortSchemaEntries(schema.properties as Record<string, CmsFieldSchema>)
        .map(([key, field]) => [key, projectDetailField(field)]),
    ),
  };
}
