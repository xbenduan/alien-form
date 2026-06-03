import { defineHandler } from '@alien-form/cms';
import type { RuntimeRuleHandler } from '@alien-form/core';
import { getHandlerConfig } from './utils';

interface CompareValueConfig {
  selector?: string;
  equals?: unknown;
  whenTrue?: unknown;
  whenFalse?: unknown;
}

const compareValue = defineHandler({
  function: ((ctx) => {
    const config = getHandlerConfig<CompareValueConfig>(ctx);
    const selector = String(config.selector ?? '');
    const expected = config.equals;
    const current = selector ? ctx.get(selector) : ctx.value;
    const matched = current === expected;
    return matched ? config.whenTrue : config.whenFalse;
  }) satisfies RuntimeRuleHandler,
  config: {
    key: 'compareValue',
    label: 'Compare Value',
    description: 'Compare a selector value against expected. Returns whenTrue/whenFalse.',
    supportedTargets: ['value', 'display', 'disabled', 'required', 'title', 'description'],
    defaultConfig: { selector: 'status', equals: 'draft', whenTrue: true, whenFalse: false },
    params: [
      {
        name: 'selector',
        type: 'string',
        required: false,
        default: 'status',
        description: '可选，读取其他字段值；不传时使用当前字段值。',
      },
      {
        name: 'equals',
        type: 'unknown',
        required: true,
        default: 'draft',
        description: '期望比较的目标值。',
      },
      {
        name: 'whenTrue',
        type: 'unknown',
        required: false,
        default: true,
        description: '命中时返回的结果。',
      },
      {
        name: 'whenFalse',
        type: 'unknown',
        required: false,
        default: false,
        description: '未命中时返回的结果。',
      },
    ],
  },
});

export default compareValue;
