import { defineHandler } from '@alien-form/cms';
import type { DataSourceItem, RuntimeRuleHandler } from '@alien-form/core';
import { getHandlerConfig } from './utils';

interface OptionsFromMapConfig {
  selector?: string;
  map?: Record<string, unknown>;
}

function toOptions(items: unknown): DataSourceItem[] {
  return Array.isArray(items) ? (items as DataSourceItem[]) : [];
}

const optionsFromMap = defineHandler({
  function: ((ctx) => {
    const config = getHandlerConfig<OptionsFromMapConfig>(ctx);
    const selector = String(config.selector ?? '');
    const key = String(selector ? ctx.get(selector) ?? 'default' : 'default');
    const map = (config.map ?? {}) as Record<string, unknown>;
    return toOptions(map[key] ?? map.default);
  }) satisfies RuntimeRuleHandler,
  config: {
    key: 'optionsFromMap',
    label: 'Options From Map',
    description: 'Return dataSource options based on a selector value lookup in a map.',
    supportedTargets: ['dataSource'],
    defaultConfig: { selector: 'category', map: { default: [] } },
    params: [
      {
        name: 'selector',
        type: 'string',
        required: false,
        default: 'category',
        description: '作为 map key 的字段选择器路径。',
      },
      {
        name: 'map',
        type: 'record',
        required: true,
        default: { default: [] },
        description: '不同 key 对应的 options 映射表。',
      },
    ],
  },
});

export default optionsFromMap;
