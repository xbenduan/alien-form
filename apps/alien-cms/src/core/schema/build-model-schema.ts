import type { CmsFieldSchema, CmsModelSchema } from '../../types/model';
import type { ModelBuilderDraft } from '../../types/model-builder';

function parseJsonText(text: string, label: string) {
  if (!text.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} 不是合法 JSON`);
  }
}

function buildNestedProperties(fields: ModelBuilderDraft['fields'], pathLabel: string) {
  return Object.fromEntries(
    fields.map((field, index) => [field.key, buildFieldSchema(field, (index + 1) * 10, `${pathLabel} > ${field.title || field.key}`)]),
  );
}

function buildFieldSchema(
  draftField: ModelBuilderDraft['fields'][number],
  order: number,
  pathLabel: string,
): CmsFieldSchema {
  const props = parseJsonText(draftField.propsText, `${draftField.title || draftField.key} 的 props`);
  const dataSource = parseJsonText(draftField.dataSourceText, `${draftField.title || draftField.key} 的 dataSource`);
  const defaultValue = parseJsonText(draftField.defaultValueText, `${draftField.title || draftField.key} 的默认值`);

  // 构建 x-reaction：直接使用 handler 名（字符串），core 原生支持 @ 引用
  const validReactions = draftField.reactions.filter((reaction) => reaction.handler);
  const xReaction = validReactions.length > 0
    ? Object.fromEntries(
        validReactions.map((reaction) => [reaction.target, `@${reaction.handler}`]),
      )
    : undefined;

  // handler 配置写入 x-cms.reactions，handler 通过 ctx.schema['x-cms'].reactions[target] 读取
  const reactionConfigs = validReactions.length > 0
    ? Object.fromEntries(
        validReactions
          .map((reaction) => {
            const config = parseJsonText(reaction.paramsText, `${draftField.title || draftField.key} 的 reaction 配置`);
            return [reaction.target, config];
          })
          .filter(([, config]) => config !== undefined),
      )
    : undefined;

  const children = draftField.children ?? [];
  const isObjectField = draftField.type === 'object';
  const isVoidField = draftField.type === 'void';
  const isArrayField = draftField.type === 'array';
  const isObjectArray = isArrayField && draftField.arrayMode === 'object';

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
    'x-reaction': xReaction,
    'x-cms': {
      filter: {
        visible: draftField.filterVisible,
        defaultVisible: draftField.filterDefaultVisible,
      },
      table: {
        visible: draftField.tableVisible,
        width: draftField.tableWidthText.trim() ? Number(draftField.tableWidthText) : undefined,
        ellipsis: draftField.tableEllipsis,
      },
      detail: {
        visible: draftField.detailVisible,
      },
      ...(reactionConfigs ? { reactions: reactionConfigs } : {}),
    },
  };

  if (isObjectField || isVoidField) {
    return {
      ...baseSchema,
      component: draftField.component || 'SectionCard',
      decorator: undefined,
      properties: buildNestedProperties(children, pathLabel),
    };
  }

  if (isObjectArray) {
    return {
      ...baseSchema,
      component: 'ArrayCards',
      decorator: 'FormItem',
      items: {
        type: 'object',
        properties: buildNestedProperties(children, pathLabel),
      },
    };
  }

  if (isArrayField) {
    return {
      ...baseSchema,
      component: draftField.component || 'TagsInput',
      decorator: 'FormItem',
      default: defaultValue ?? [],
    };
  }

  return baseSchema;
}

export function buildModelSchema(draft: ModelBuilderDraft): CmsModelSchema {
  const properties = Object.fromEntries(
    draft.fields.map((field, index) => [field.key, buildFieldSchema(field, (index + 1) * 10, field.title || field.key)]),
  );

  return {
    type: 'object',
    title: draft.title,
    description: draft.description,
    properties,
    'x-model': {
      name: draft.modelName,
      title: draft.title,
      subtitle: draft.subtitle || undefined,
      description: draft.description || undefined,
      singularLabel: draft.singularLabel || '记录',
      pluralLabel: draft.pluralLabel || '记录',
      defaultFilterCount: draft.defaultFilterCount,
      defaultPageSize: draft.defaultPageSize,
      openMode: {
        add: draft.openMode.add,
        edit: draft.openMode.edit,
        detail: draft.openMode.detail,
      },
    },
  };
}
