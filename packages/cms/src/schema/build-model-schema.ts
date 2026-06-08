import type { CmsFieldSchema, CmsModelSchema } from "../types/schema";
import type { ModelBuilderDraft, ModelBuilderFieldDraft } from "../types/builder";

function parseJsonText(text: string, label: string) {
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

function buildNestedProperties(fields: ModelBuilderFieldDraft[], pathLabel: string) {
  return Object.fromEntries(
    fields.map((field, index) => [
      field.key,
      buildFieldSchema(field, (index + 1) * 10, `${pathLabel} > ${field.title || field.key}`),
    ]),
  );
}

function buildFieldSchema(
  draftField: ModelBuilderFieldDraft,
  order: number,
  pathLabel: string,
): CmsFieldSchema {
  const props = parseJsonText(draftField.propsText, `${draftField.title || draftField.key} props`);
  const dataSource = parseJsonText(draftField.dataSourceText, `${draftField.title || draftField.key} dataSource`);
  const defaultValue = parseJsonText(draftField.defaultValueText, `${draftField.title || draftField.key} default`);

  const validReactions = draftField.reactions.filter((reaction) => {
    if (reaction.mode === "expression") {
      return Boolean(reaction.expressionText.trim());
    }
    return Boolean(reaction.handler);
  });
  const xReaction = validReactions.length > 0
    ? Object.fromEntries(
        validReactions.map((reaction) => [
          reaction.target,
          reaction.mode === "expression"
            ? `{{ ${reaction.expressionText.trim()} }}`
            : `@${reaction.handler}`,
        ]),
      )
    : undefined;

  const reactionConfigs = validReactions.reduce<Record<string, Record<string, unknown>>>(
    (configs, reaction) => {
      if (reaction.mode !== "handler") {
        return configs;
      }

      const params = Object.fromEntries(
        Object.entries(reaction.handlerParams).filter(([, value]) => value.trim()),
      );
      if (Object.keys(params).length > 0) {
        configs[reaction.target] = { params };
      }
      return configs;
    },
    {},
  );

  const children = draftField.children ?? [];
  const isContainer = draftField.type === "object" || draftField.type === "void";
  const isObjectArray = draftField.type === "array";

  const baseTableMeta = {
    width: draftField.tableWidthText.trim() ? Number(draftField.tableWidthText) : undefined,
    ellipsis: draftField.tableEllipsis,
    inline: draftField.tableInlineFields.length > 0 ? draftField.tableInlineFields : undefined,
  };

  const baseSchema: CmsFieldSchema = {
    type: draftField.type,
    title: draftField.title,
    component: draftField.component,
    decorator: draftField.decorator,
    required: draftField.required,
    order,
    default: defaultValue,
    props: props as Record<string, unknown> | undefined,
    dataSource: Array.isArray(dataSource) ? dataSource : undefined,
    "x-reaction": xReaction,
    "x-cms": {
      table: baseTableMeta,
      ...(Object.keys(reactionConfigs).length > 0 ? { reactions: reactionConfigs } : {}),
    },
  };

  if (isContainer) {
    return {
      ...baseSchema,
      component: draftField.component || "SectionCard",
      decorator: undefined,
      properties: buildNestedProperties(children, pathLabel),
    };
  }

  if (isObjectArray) {
    return {
      ...baseSchema,
      component: "ArrayCards",
      decorator: "FormItem",
      items: {
        type: "object",
        properties: buildNestedProperties(children, pathLabel),
      },
    };
  }

  if (draftField.type === "tags") {
    return {
      ...baseSchema,
      component: draftField.component || "TagsInput",
      decorator: "FormItem",
      default: defaultValue ?? [],
    };
  }

  if (draftField.key === "id") {
    return {
      ...baseSchema,
      type: "string",
      component: "Input",
      decorator: "FormItem",
      display: "none",
    };
  }

  if (draftField.key === "createdAt" || draftField.key === "updatedAt") {
    return {
      ...baseSchema,
      type: "number",
      component: "NumberInput",
      decorator: "FormItem",
      "x-cms": {
        ...baseSchema["x-cms"],
        table: {
          ...baseTableMeta,
          format: "dateTime",
        },
        form: {
          modes: [],
        },
        detail: {
          format: "dateTime",
        },
      },
    };
  }

  return baseSchema;
}

export function buildModelSchema(draft: ModelBuilderDraft): CmsModelSchema {
  const properties = Object.fromEntries(
    draft.fields.map((field, index) => [
      field.key,
      buildFieldSchema(field, (index + 1) * 10, field.title || field.key),
    ]),
  );

  return {
    type: "object",
    title: draft.title,
    description: draft.description,
    properties,
    "x-model": {
      name: draft.modelName,
      title: draft.title,
      subtitle: draft.subtitle || undefined,
      description: draft.description || undefined,
      singularLabel: draft.singularLabel || "Record",
      pluralLabel: draft.pluralLabel || "Records",
      filter: {
        count: draft.filterCount,
      },
      table: draft.tableVisibleFields.length > 0 || draft.tableDefaultWidth != null
        ? {
            width: draft.tableDefaultWidth,
            visible: draft.tableVisibleFields.length > 0 ? draft.tableVisibleFields : undefined,
          }
        : undefined,
      defaultPageSize: draft.defaultPageSize,
      openMode: {
        add: draft.openMode.add,
        edit: draft.openMode.edit,
        detail: draft.openMode.detail,
      },
    },
  };
}
