import { defineHandler } from '@alien-form/cms';
import type { RuntimeRuleHandler } from '@alien-form/core';
import { getHandlerConfig } from './utils';
import {
  buildLabel,
  getValueByPath,
  listModelRecords,
  matchesRecordFilter,
  type ModelRecordOptionsConfig,
} from './record-handler-utils';

const modelRecordOptions = defineHandler({
  function: (async (ctx) => {
    const config = getHandlerConfig<ModelRecordOptionsConfig>(ctx);
    const selectorValue = config.selector ? ctx.get(config.selector) : undefined;
    const modelName = String(config.model ?? selectorValue ?? '');
    if (!modelName || (config.requireSelector && !selectorValue)) {
      return [];
    }

    const records = await listModelRecords(modelName);
    return records
      .filter((record) => (config.filters ?? []).every((filter) => matchesRecordFilter(record, filter, ctx)))
      .map((record) => ({
        label: buildLabel(record, config.labelField),
        value: getValueByPath(record, config.valueField ?? 'id'),
      }))
      .filter((item) => item.value !== undefined);
  }) satisfies RuntimeRuleHandler,
  config: {
    key: 'modelRecordOptions',
    label: 'Model Record Options',
    description: 'Load records from a model and map them to dataSource options.',
    supportedTargets: ['dataSource'],
    defaultConfig: { model: '', selector: '', requireSelector: false, labelField: 'name', valueField: 'id', filters: [] },
    params: [
      { name: 'model', type: 'string', required: false, default: '', description: '固定模型名，不传时可由 selector 动态提供。' },
      { name: 'selector', type: 'string', required: false, default: '', description: '动态读取模型名或联动字段值的选择器。' },
      { name: 'requireSelector', type: 'boolean', required: false, default: false, description: '开启后要求 selector 有值才发起查询。' },
      { name: 'labelField', type: 'string|string[]', required: false, default: 'name', description: '用于生成选项展示文案的字段。' },
      { name: 'valueField', type: 'string', required: false, default: 'id', description: '作为选项值输出的字段。' },
      { name: 'filters', type: 'RecordFilterConfig[]', required: false, default: [], description: '查询后在前端做二次过滤的规则列表。' },
    ],
  },
});

export default modelRecordOptions;
