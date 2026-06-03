import { defineHandler } from '@alien-form/cms';
import { getRecord } from '@alien-form/cms';
import type { RuntimeRuleHandler } from '@alien-form/core';
import { getHandlerConfig } from './utils';
import {
  getValueByPath,
  toDataSourceItems,
  type RelatedRecordFieldOptionsConfig,
} from './record-handler-utils';

const relatedRecordFieldOptions = defineHandler({
  function: (async (ctx) => {
    const config = getHandlerConfig<RelatedRecordFieldOptionsConfig>(ctx);
    const recordId = config.selector ? ctx.get(config.selector) : undefined;
    if (!config.model || !recordId) {
      return [];
    }

    const record = await getRecord(config.model, String(recordId));
    return toDataSourceItems(getValueByPath(record, config.sourceField), config.labelField, config.valueField);
  }) satisfies RuntimeRuleHandler,
  config: {
    key: 'relatedRecordFieldOptions',
    label: 'Related Record Field Options',
    description: 'Read an existing record field and map nested array data to options.',
    supportedTargets: ['dataSource'],
    defaultConfig: { model: '', selector: '', sourceField: '', labelField: 'label', valueField: 'value' },
    params: [
      { name: 'model', type: 'string', required: true, default: '', description: '目标模型名。' },
      { name: 'selector', type: 'string', required: true, default: '', description: '用于读取目标记录 id 的选择器。' },
      { name: 'sourceField', type: 'string', required: true, default: '', description: '记录中承载选项数据的字段路径。' },
      { name: 'labelField', type: 'string', required: false, default: 'label', description: '选项标签字段。' },
      { name: 'valueField', type: 'string', required: false, default: 'value', description: '选项值字段。' },
    ],
  },
});

export default relatedRecordFieldOptions;
