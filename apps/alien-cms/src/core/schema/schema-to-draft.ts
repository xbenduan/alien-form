import type { CmsFieldSchema, CmsModelSchema } from '../../types/model';
import type { BuilderComponentName, BuilderFieldType, ModelBuilderDraft, ModelBuilderFieldDraft, ModelBuilderReactionDraft } from '../../types/model-builder';

let draftFieldCounter = 0;

function inferFieldType(field: CmsFieldSchema): BuilderFieldType {
  const t = field.type;
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'object' || t === 'void' || t === 'array') {
    return t as BuilderFieldType;
  }
  return 'string';
}

function inferComponent(field: CmsFieldSchema, fieldType: BuilderFieldType): BuilderComponentName {
  if (field.component) {
    return field.component as BuilderComponentName;
  }
  const defaults: Record<BuilderFieldType, BuilderComponentName> = {
    string: 'Input',
    number: 'NumberInput',
    boolean: 'Switch',
    object: 'SectionCard',
    void: 'SectionCard',
    array: 'TagsInput',
  };
  return defaults[fieldType] ?? 'Input';
}

function buildReactions(field: CmsFieldSchema): ModelBuilderReactionDraft[] {
  const xReaction = field['x-reaction'];
  if (!xReaction || typeof xReaction !== 'object') return [];

  const reactionConfigs = field['x-cms']?.reactions ?? {};

  return Object.entries(xReaction).map(([target, handler]) => {
    const handlerStr = typeof handler === 'string' ? handler.replace(/^@/, '') : '';
    const config = reactionConfigs[target];
    return {
      id: `reaction-${Date.now()}-${(++draftFieldCounter).toString(36)}`,
      target: target as ModelBuilderReactionDraft['target'],
      handler: handlerStr,
      paramsText: config ? JSON.stringify(config, null, 2) : '',
    };
  });
}

function fieldSchemaToDraft(key: string, field: CmsFieldSchema): ModelBuilderFieldDraft {
  const fieldType = inferFieldType(field);
  const component = inferComponent(field, fieldType);
  const isContainer = fieldType === 'object' || fieldType === 'void';
  const isObjectArray = fieldType === 'array' && component === 'ArrayCards';

  const cms = field['x-cms'] ?? {};

  let children: ModelBuilderFieldDraft[] | undefined;
  if (isContainer && field.properties) {
    children = Object.entries(field.properties).map(([childKey, childField]) =>
      fieldSchemaToDraft(childKey, childField as CmsFieldSchema)
    );
  } else if (isObjectArray && field.items && typeof field.items === 'object' && 'properties' in field.items) {
    const itemProps = (field.items as { properties?: Record<string, CmsFieldSchema> }).properties ?? {};
    children = Object.entries(itemProps).map(([childKey, childField]) =>
      fieldSchemaToDraft(childKey, childField)
    );
  } else if (isContainer || isObjectArray) {
    children = [];
  }

  return {
    id: `field-${Date.now()}-${(++draftFieldCounter).toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    key,
    title: field.title ?? key,
    type: fieldType,
    component,
    decorator: isContainer ? undefined : (field.decorator as 'FormItem' | undefined) ?? 'FormItem',
    required: field.required ?? false,
    defaultValueText: field.default !== undefined ? JSON.stringify(field.default) : '',
    propsText: field.props ? JSON.stringify(field.props, null, 2) : '{}',
    dataSourceText: field.dataSource ? JSON.stringify(field.dataSource, null, 2) : '',
    filterVisible: cms.filter?.visible ?? (!isContainer && fieldType !== 'array'),
    filterDefaultVisible: cms.filter?.defaultVisible ?? false,
    tableVisible: cms.table?.visible ?? !isContainer,
    tableWidthText: cms.table?.width != null ? String(cms.table.width) : '',
    tableEllipsis: cms.table?.ellipsis ?? true,
    detailVisible: cms.detail?.visible ?? true,
    reactions: buildReactions(field),
    children,
    arrayMode: fieldType === 'array' ? (component === 'ArrayCards' ? 'object' : 'tags') : undefined,
    itemTitle: isObjectArray ? (field.items as { title?: string })?.title ?? '数组项' : undefined,
  };
}

export function schemaToBuilderDraft(schema: CmsModelSchema): ModelBuilderDraft {
  const meta = schema['x-model'] ?? {};
  const properties = schema.properties ?? {};

  const fields = Object.entries(properties)
    .sort(([, a], [, b]) => ((a as CmsFieldSchema).order ?? 0) - ((b as CmsFieldSchema).order ?? 0))
    .map(([key, field]) => fieldSchemaToDraft(key, field as CmsFieldSchema));

  return {
    modelName: meta.name ?? '',
    title: meta.title ?? schema.title ?? '',
    subtitle: meta.subtitle ?? '',
    description: meta.description ?? schema.description ?? '',
    singularLabel: meta.singularLabel ?? '记录',
    pluralLabel: meta.pluralLabel ?? '记录',
    defaultPageSize: meta.defaultPageSize ?? 10,
    defaultFilterCount: meta.defaultFilterCount ?? 3,
    openMode: {
      add: meta.openMode?.add ?? 'drawer',
      edit: meta.openMode?.edit ?? 'drawer',
      detail: meta.openMode?.detail ?? 'drawer',
    },
    fields: fields.length > 0 ? fields : [],
  };
}
