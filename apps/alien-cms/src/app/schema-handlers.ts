import type { DataSourceItem, FormConfig } from '@alien-form/react';

export interface SchemaHandlerCatalogItem {
  name: string;
  label: string;
  description: string;
  supportedTargets: Array<'value' | 'display' | 'disabled' | 'required' | 'title' | 'description' | 'props' | 'dataSource'>;
  defaultConfig: Record<string, unknown>;
}

function toOptions(items: unknown): DataSourceItem[] {
  return Array.isArray(items) ? (items as DataSourceItem[]) : [];
}

/**
 * 从字段 schema 的 x-cms.reactions[target] 中读取 handler 配置。
 * 用户在 schema 的 x-cms 里配什么，handler 就能读到什么，不需要 core 额外支持。
 */
function getHandlerConfig(ctx: { schema: any; key?: string }): Record<string, unknown> {
  const xcms = ctx.schema?.['x-cms'];
  if (!xcms?.reactions) return {};
  const target = ctx.key ?? '';
  const config = xcms.reactions[target];
  return config && typeof config === 'object' ? config : {};
}

export const schemaHandlers: FormConfig['handlers'] = {
  copyFromSelector: (ctx) => {
    const config = getHandlerConfig(ctx);
    const selector = String(config.selector ?? '');
    return selector ? ctx.get(selector) : undefined;
  },
  compareValue: (ctx) => {
    const config = getHandlerConfig(ctx);
    const selector = String(config.selector ?? '');
    const expected = config.equals;
    const current = selector ? ctx.get(selector) : ctx.value;
    const matched = current === expected;
    return matched ? config.whenTrue : config.whenFalse;
  },
  optionsFromMap: (ctx) => {
    const config = getHandlerConfig(ctx);
    const selector = String(config.selector ?? '');
    const key = String(selector ? ctx.get(selector) ?? 'default' : 'default');
    const map = (config.map ?? {}) as Record<string, unknown>;
    return toOptions(map[key] ?? map.default);
  },
  templateText: (ctx) => {
    const config = getHandlerConfig(ctx);
    const selector = String(config.selector ?? '');
    const value = selector ? ctx.get(selector) : ctx.value;
    const prefix = String(config.prefix ?? '');
    const suffix = String(config.suffix ?? '');
    return `${prefix}${value ?? ''}${suffix}`;
  },
};

export const schemaHandlerCatalog: SchemaHandlerCatalogItem[] = [
  {
    name: 'copyFromSelector',
    label: '复制字段值',
    description: '从指定 selector 读取值，常用于 value/title/description 派生。',
    supportedTargets: ['value', 'title', 'description'],
    defaultConfig: {
      selector: 'otherField',
    },
  },
  {
    name: 'compareValue',
    label: '条件比较',
    description: '比较指定 selector 的值，相等时返回 whenTrue，否则返回 whenFalse。',
    supportedTargets: ['value', 'display', 'disabled', 'required', 'title', 'description'],
    defaultConfig: {
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
    defaultConfig: {
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
    defaultConfig: {
      selector: 'title',
      prefix: '',
      suffix: '（预览）',
    },
  },
];
