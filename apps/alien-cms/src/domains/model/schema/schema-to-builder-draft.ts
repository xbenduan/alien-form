import type {
  BuilderComponentName,
  BuilderFieldType,
  CmsFieldSchema,
  CmsModelMeta,
  CmsModelSchema,
  ModelBuilderDraft,
  ModelBuilderFieldDraft,
  ModelBuilderReactionDraft,
} from "../types";

let draftFieldCounter = 0;

function inferFieldType(field: CmsFieldSchema): BuilderFieldType {
  if (field["x-layout"]) return "layout";
  const type = field.type;
  if (
    type === "string" ||
    type === "number" ||
    type === "boolean" ||
    type === "object" ||
    type === "array" ||
    type === "tags"
  ) {
    return type;
  }
  return "string";
}

function inferComponent(field: CmsFieldSchema, fieldType: BuilderFieldType): BuilderComponentName {
  if (field.component) return field.component as BuilderComponentName;
  if (field["x-layout"]) return field["x-layout"] as BuilderComponentName;

  const defaults: Record<BuilderFieldType, BuilderComponentName> = {
    string: "Input",
    number: "NumberInput",
    boolean: "Switch",
    object: "SectionCard",
    layout: "SectionCard",
    array: "ArrayCards",
    tags: "TagsInput",
  };
  return defaults[fieldType];
}

function isExpressionReaction(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("{{") && trimmed.endsWith("}}");
}

function unwrapExpression(value: string) {
  return value.trim().slice(2, -2).trim();
}

function normalizeHandlerParams(config: unknown) {
  if (!config || typeof config !== "object") return {};
  const rawParams =
    "params" in config && config.params && typeof config.params === "object"
      ? (config.params as Record<string, unknown>)
      : (config as Record<string, unknown>);

  return Object.fromEntries(
    Object.entries(rawParams).map(([key, value]) => [
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    ]),
  );
}

function buildReactions(field: CmsFieldSchema): ModelBuilderReactionDraft[] {
  const reactions = field["x-reaction"];
  if (!reactions || typeof reactions !== "object") return [];
  const reactionConfigs = field["x-cms"]?.reactions ?? {};

  return Object.entries(reactions as Record<string, unknown>).map(([target, reactionRule]) => {
    const ruleText = typeof reactionRule === "string" ? reactionRule : "";
    const isHandler = ruleText.startsWith("@");
    return {
      id: `reaction-${Date.now()}-${(++draftFieldCounter).toString(36)}`,
      target: target as ModelBuilderReactionDraft["target"],
      mode: isHandler ? "handler" : "expression",
      handler: isHandler ? ruleText.replace(/^@/, "") : "",
      expressionText: !isHandler
        ? isExpressionReaction(ruleText)
          ? unwrapExpression(ruleText)
          : ruleText
        : "",
      handlerParams: isHandler ? normalizeHandlerParams(reactionConfigs[target]) : {},
    };
  });
}

function fieldSchemaToDraft(key: string, field: CmsFieldSchema): ModelBuilderFieldDraft {
  const fieldType = inferFieldType(field);
  const component = inferComponent(field, fieldType);
  const isContainer = fieldType === "object" || fieldType === "layout";
  const isObjectArray = fieldType === "array";
  const cms = field["x-cms"] ?? {};

  let children: ModelBuilderFieldDraft[] | undefined;
  if (isContainer && field.properties) {
    children = Object.entries(field.properties).map(([childKey, childField]) =>
      fieldSchemaToDraft(childKey, childField),
    );
  } else if (
    isObjectArray &&
    field.items &&
    !Array.isArray(field.items) &&
    field.items.properties
  ) {
    children = Object.entries(field.items.properties).map(([childKey, childField]) =>
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
    decorator: isContainer
      ? undefined
      : ((field.decorator as "FormItem" | undefined) ?? "FormItem"),
    required,
    defaultValueText: field.default !== undefined ? JSON.stringify(field.default) : "",
    propsText: field.props ? JSON.stringify(field.props, null, 2) : "{}",
    dataSourceText: field.dataSource ? JSON.stringify(field.dataSource, null, 2) : "",
    tableWidthText: cms.table?.width != null ? String(cms.table.width) : "",
    tableEllipsis: cms.table?.ellipsis ?? true,
    tableInlineFields: cms.table?.inline ?? [],
    reactions: buildReactions(field),
    children,
    arrayMode: fieldType === "array" ? "object" : undefined,
    itemTitle:
      isObjectArray && field.items && !Array.isArray(field.items)
        ? (field.items.title ?? "Item")
        : undefined,
  };
}

export function schemaToBuilderDraft(schema: CmsModelSchema): ModelBuilderDraft {
  const meta: CmsModelMeta = schema["x-model"] ?? { name: "" };
  const fields = Object.entries(schema.properties ?? {})
    .sort(([, left], [, right]) => (left.order ?? 0) - (right.order ?? 0))
    .map(([key, field]) => fieldSchemaToDraft(key, field));

  return {
    modelName: meta.name,
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
