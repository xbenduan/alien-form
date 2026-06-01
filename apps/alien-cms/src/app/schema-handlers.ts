import type { DataSourceItem, FormConfig } from '@alien-form/react';

export interface SchemaHandlerCatalogItem {
  name: string;
  label: string;
  description: string;
  supportedTargets: Array<'value' | 'display' | 'disabled' | 'required' | 'title' | 'description' | 'props' | 'dataSource'>;
  defaultParams: Record<string, unknown>;
}

function toOptions(items: unknown): DataSourceItem[] {
  return Array.isArray(items) ? (items as DataSourceItem[]) : [];
}

export const schemaHandlers: FormConfig['handlers'] = {
  copyFromSelector: (ctx) => {
    const selector = String(ctx.rule?.params?.selector ?? '');
    return selector ? ctx.get(selector) : undefined;
  },
  compareValue: (ctx) => {
    const selector = String(ctx.rule?.params?.selector ?? '');
    const expected = ctx.rule?.params?.equals;
    const current = selector ? ctx.get(selector) : ctx.value;
    const matched = current === expected;
    return matched ? ctx.rule?.params?.whenTrue : ctx.rule?.params?.whenFalse;
  },
  optionsFromMap: (ctx) => {
    const selector = String(ctx.rule?.params?.selector ?? '');
    const key = String(selector ? ctx.get(selector) ?? 'default' : 'default');
    const map = (ctx.rule?.params?.map ?? {}) as Record<string, unknown>;
    return toOptions(map[key] ?? map.default);
  },
  templateText: (ctx) => {
    const selector = String(ctx.rule?.params?.selector ?? '');
    const value = selector ? ctx.get(selector) : ctx.value;
    const prefix = String(ctx.rule?.params?.prefix ?? '');
    const suffix = String(ctx.rule?.params?.suffix ?? '');
    return `${prefix}${value ?? ''}${suffix}`;
  },
};

export const schemaHandlerCatalog: SchemaHandlerCatalogItem[] = [
  {
    name: 'copyFromSelector',
    label: '复制字段值',
    description: '从指定 selector 读取值，常用于 value/title/description 派生。',
    supportedTargets: ['value', 'title', 'description'],
    defaultParams: {
      selector: 'otherField',
    },
  },
  {
    name: 'compareValue',
    label: '条件比较',
    description: '比较指定 selector 的值，相等时返回 whenTrue，否则返回 whenFalse。',
    supportedTargets: ['value', 'display', 'disabled', 'required', 'title', 'description'],
    defaultParams: {
      selector: 'status',
      equals: 'draft',
      whenTrue: true,
      whenFalse: false,
    },
  },
  {
    name: 'optionsFromMap',
    label: '映射选项',
    description: '根据指定 selector 的当前值返回一组 dataSource 选项。',
    supportedTargets: ['dataSource'],
    defaultParams: {
      selector: 'category',
      map: {
        default: [],
      },
    },
  },
  {
    name: 'templateText',
    label: '模板文本',
    description: '读取指定 selector，并拼接 prefix/suffix 生成文本。',
    supportedTargets: ['value', 'title', 'description'],
    defaultParams: {
      selector: 'title',
      prefix: '',
      suffix: '（预览）',
    },
  },
];
