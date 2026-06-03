import { defineHandler } from '@alien-form/cms';
import type { RuntimeRuleHandler } from '@alien-form/core';
import { getHandlerConfig } from './utils';

interface TemplateTextConfig {
  selector?: string;
  prefix?: string;
  suffix?: string;
}

const templateText = defineHandler({
  function: ((ctx) => {
    const config = getHandlerConfig<TemplateTextConfig>(ctx);
    const selector = String(config.selector ?? '');
    const value = selector ? ctx.get(selector) : ctx.value;
    const prefix = String(config.prefix ?? '');
    const suffix = String(config.suffix ?? '');
    return `${prefix}${value ?? ''}${suffix}`;
  }) satisfies RuntimeRuleHandler,
  config: {
    key: 'templateText',
    label: 'Template Text',
    description: 'Read a selector value and concatenate with prefix/suffix.',
    supportedTargets: ['value', 'title', 'description'],
    defaultConfig: { selector: 'title', prefix: '', suffix: ' (preview)' },
    params: [
      {
        name: 'selector',
        type: 'string',
        required: false,
        default: 'title',
        description: '要读取的字段选择器路径。',
      },
      {
        name: 'prefix',
        type: 'string',
        required: false,
        default: '',
        description: '前缀文本。',
      },
      {
        name: 'suffix',
        type: 'string',
        required: false,
        default: ' (preview)',
        description: '后缀文本。',
      },
    ],
  },
});

export default templateText;
