import { defineHandler } from '@alien-form/cms';
import type { RuntimeRuleHandler } from '@alien-form/core';
import { getHandlerConfig } from './utils';

interface CopyFromSelectorConfig {
  selector?: string;
}

const copyFromSelector = defineHandler({
  function: ((ctx) => {
    const config = getHandlerConfig<CopyFromSelectorConfig>(ctx);
    const selector = String(config.selector ?? '');
    return selector ? ctx.get(selector) : undefined;
  }) satisfies RuntimeRuleHandler,
  config: {
    key: 'copyFromSelector',
    label: 'Copy Field Value',
    description: 'Read value from a selector path. Used for value/title/description derivation.',
    supportedTargets: ['value', 'title', 'description'],
    defaultConfig: { selector: 'otherField' },
    params: [
      {
        name: 'selector',
        type: 'string',
        required: true,
        default: 'otherField',
        description: '字段选择器路径，例如 status 或 user.name。',
      },
    ],
  },
});

export default copyFromSelector;
