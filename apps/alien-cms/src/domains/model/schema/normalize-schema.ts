import type { CmsFieldSchema, CmsModelSchema } from "../types";

function getDefaultComponent(field: CmsFieldSchema): string {
  if (field.component) return field.component;
  if (field["x-layout"]) return field["x-layout"];
  if (field.type === "number") return "NumberInput";
  if (field.type === "boolean") return "Switch";
  if (field.type === "array") return "ArrayCards";
  if (field.type === "tags") return "TagsInput";
  return "Input";
}

function normalizeField(key: string, field: CmsFieldSchema): CmsFieldSchema {
  const isContainer = Boolean(field["x-layout"]) || field.type === "object";
  const normalized: CmsFieldSchema = {
    ...field,
    title: field.title ?? key,
    component: getDefaultComponent(field),
    decorator: field.decorator ?? (isContainer ? undefined : "FormItem"),
    order: field.order ?? 0,
    props: field.props ?? {},
    "x-cms": {
      ...field["x-cms"],
      table: {
        width: field["x-cms"]?.table?.width,
        ellipsis: field["x-cms"]?.table?.ellipsis,
        format: field["x-cms"]?.table?.format,
        inline: field["x-cms"]?.table?.inline,
        expandable: field["x-cms"]?.table?.expandable,
        visible: field["x-cms"]?.table?.visible,
        order: field["x-cms"]?.table?.order,
      },
      filter: field["x-cms"]?.filter,
      form: {
        modes: field["x-cms"]?.form?.modes,
      },
      detail: {
        format: field["x-cms"]?.detail?.format ?? field["x-cms"]?.table?.format,
      },
      mobile: field["x-cms"]?.mobile,
    },
  };

  if (normalized.properties) {
    normalized.properties = Object.fromEntries(
      Object.entries(normalized.properties).map(([nestedKey, nestedField]) => [
        nestedKey,
        normalizeField(nestedKey, nestedField),
      ]),
    );
  }

  if (normalized.items && !Array.isArray(normalized.items) && normalized.items.properties) {
    normalized.items = {
      ...normalized.items,
      properties: Object.fromEntries(
        Object.entries(normalized.items.properties).map(([itemKey, itemField]) => [
          itemKey,
          normalizeField(itemKey, itemField),
        ]),
      ),
    };
  }

  return normalized;
}

export function normalizeSchema(rawSchema: CmsModelSchema): CmsModelSchema {
  const normalizedProperties = Object.fromEntries(
    Object.entries(rawSchema.properties ?? {}).map(([key, field]) => [
      key,
      normalizeField(key, field),
    ]),
  );

  return {
    ...rawSchema,
    properties: normalizedProperties,
    "x-model": {
      name: rawSchema["x-model"]?.name ?? "unknown",
      title: rawSchema["x-model"]?.title ?? rawSchema.title ?? "Model",
      subtitle: rawSchema["x-model"]?.subtitle ?? rawSchema["x-model"]?.name,
      description: rawSchema["x-model"]?.description ?? rawSchema.description,
      singularLabel: rawSchema["x-model"]?.singularLabel ?? "Record",
      pluralLabel: rawSchema["x-model"]?.pluralLabel ?? "Records",
      primaryField: rawSchema["x-model"]?.primaryField ?? "id",
      filter: {
        count: rawSchema["x-model"]?.filter?.count ?? 3,
      },
      table: rawSchema["x-model"]?.table
        ? {
            width: rawSchema["x-model"].table?.width,
            visible: rawSchema["x-model"].table?.visible,
          }
        : undefined,
      defaultPageSize: rawSchema["x-model"]?.defaultPageSize ?? 10,
      openMode: rawSchema["x-model"]?.openMode,
      actions: rawSchema["x-model"]?.actions,
    },
  };
}
