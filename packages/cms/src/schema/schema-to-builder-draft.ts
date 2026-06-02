import type { CmsFieldSchema, CmsModelMeta, CmsModelSchema } from "../types/schema";
import type {
  BuilderComponentName,
  BuilderFieldType,
  ModelBuilderDraft,
  ModelBuilderFieldDraft,
  ModelBuilderReactionDraft,
} from "../types/builder";

let draftFieldCounter = 0;

function inferFieldType(field: CmsFieldSchema): BuilderFieldType {
  const type = field.type;
  if (type === "string" || type === "number" || type === "boolean" || type === "object" || type === "void" || type === "array") {
    return type as BuilderFieldType;
  }
  return "string";
}

function inferComponent(field: CmsFieldSchema, fieldType: BuilderFieldType): BuilderComponentName {
  if (field.component) {
    return field.component as BuilderComponentName;
  }

  const defaults: Record<BuilderFieldType, BuilderComponentName> = {
    string: "Input",
    number: "NumberInput",
    boolean: "Switch",
    object: "SectionCard",
    void: "SectionCard",
    array: "TagsInput",
  };

  return defaults[fieldType] ?? "Input";
}

function buildReactions(field: CmsFieldSchema): ModelBuilderReactionDraft[] {
  const reactions = field["x-reaction"];
  if (!reactions || typeof reactions !== "object") return [];

  const reactionConfigs = field["x-cms"]?.reactions ?? {};

  return Object.entries(reactions as Record<string, unknown>).map(([target, handler]) => {
    const handlerName = typeof handler === "string" ? handler.replace(/^@/, "") : "";
    const config = reactionConfigs[target];

    return {
      id: `reaction-${Date.now()}-${(++draftFieldCounter).toString(36)}`,
      target: target as ModelBuilderReactionDraft["target"],
      handler: handlerName,
      paramsText: config ? JSON.stringify(config, null, 2) : "",
    };
  });
}

function fieldSchemaToDraft(key: string, field: CmsFieldSchema): ModelBuilderFieldDraft {
  const fieldType = inferFieldType(field);
  const component = inferComponent(field, fieldType);
  const isContainer = fieldType === "object" || fieldType === "void";
  const isObjectArray = fieldType === "array" && component === "ArrayCards";
  const cms = field["x-cms"] ?? {};

  let children: ModelBuilderFieldDraft[] | undefined;
  if (isContainer && field.properties) {
    children = Object.entries(field.properties).map(([childKey, childField]) =>
      fieldSchemaToDraft(childKey, childField as CmsFieldSchema),
    );
  } else if (isObjectArray && field.items && !Array.isArray(field.items) && field.items.properties) {
    children = Object.entries(field.items.properties as Record<string, CmsFieldSchema>).map(([childKey, childField]) =>
      fieldSchemaToDraft(childKey, childField),
    );
  } else if (isContainer || isObjectArray) {
    children = [];
  }

  const requiredRaw = field.required;
  const required =
    typeof requiredRaw === "boolean"
      ? requiredRaw
      : Array.isArray(requiredRaw)
        ? requiredRaw.length > 0
        : false;

  return {
    id: `field-${Date.now()}-${(++draftFieldCounter).toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    key,
    title: field.title ?? key,
    type: fieldType,
    component,
    decorator: isContainer ? undefined : (field.decorator as "FormItem" | undefined) ?? "FormItem",
    required,
    defaultValueText: field.default !== undefined ? JSON.stringify(field.default) : "",
    propsText: field.props ? JSON.stringify(field.props, null, 2) : "{}",
    dataSourceText: field.dataSource ? JSON.stringify(field.dataSource, null, 2) : "",
    tableWidthText: cms.table?.width != null ? String(cms.table.width) : "",
    tableEllipsis: cms.table?.ellipsis ?? true,
    tableInlineFields: cms.table?.inline ?? [],
    reactions: buildReactions(field),
    children,
    arrayMode: fieldType === "array" ? (component === "ArrayCards" ? "object" : "tags") : undefined,
    itemTitle: isObjectArray ? ((field.items as { title?: string } | undefined)?.title ?? "Item") : undefined,
  };
}

export function schemaToBuilderDraft(schema: CmsModelSchema): ModelBuilderDraft {
  const meta: CmsModelMeta = schema["x-model"] ?? { name: "" };
  const properties = schema.properties ?? {};

  const fields = Object.entries(properties)
    .sort(([, left], [, right]) => ((left as CmsFieldSchema).order ?? 0) - ((right as CmsFieldSchema).order ?? 0))
    .map(([key, field]) => fieldSchemaToDraft(key, field as CmsFieldSchema));

  return {
    modelName: meta.name ?? "",
    title: meta.title ?? schema.title ?? "",
    subtitle: meta.subtitle ?? "",
    description: meta.description ?? schema.description ?? "",
    singularLabel: meta.singularLabel ?? "Record",
    pluralLabel: meta.pluralLabel ?? "Records",
    defaultPageSize: meta.defaultPageSize ?? 10,
    filterCount: meta.filter?.count ?? 3,
    tableDefaultWidth: meta.table?.width,
    tableVisibleFields: meta.table?.visible ?? [],
    openMode: {
      add: meta.openMode?.add ?? "drawer",
      edit: meta.openMode?.edit ?? "drawer",
      detail: meta.openMode?.detail ?? "drawer",
    },
    fields,
  };
}
