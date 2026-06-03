import { defineHandler } from '@alien-form/cms';
import type { DataSourceItem, RuntimeRuleHandler } from '@alien-form/core';
import { getHandlerConfig } from './utils';
import {
  collectSchemaFields,
  loadModelSchema,
  type SchemaFieldOptionsConfig,
} from './record-handler-utils';

const schemaFieldOptions = defineHandler({
  function: (async (ctx) => {
    const config = getHandlerConfig<SchemaFieldOptionsConfig>(ctx);
    const selectorValue = config.selector ? ctx.get(config.selector) : undefined;
    const modelName = String(config.model ?? selectorValue ?? '');
    if (!modelName) {
      return [];
    }

    const schema = await loadModelSchema(modelName);
    if (!schema?.properties) {
      return [];
    }

    const options: DataSourceItem[] = [];
    collectSchemaFields(schema.properties, options, {
      includeContainers: false,
      excludeTypes: ['object', 'array', 'void'],
      valueMode: 'key',
      ...config,
    });
    return options;
  }) satisfies RuntimeRuleHandler,
  config: {
    key: 'schemaFieldOptions',
    label: 'Schema Field Options',
    description: 'Load schema fields from a model and convert them to options.',
    supportedTargets: ['dataSource'],
    defaultConfig: { model: '', selector: '', includeTypes: [], excludeTypes: ['object', 'array', 'void'], includeContainers: false, valueMode: 'key' },
    params: [
      { name: 'model', type: 'string', required: false, default: '', description: '固定模型名。' },
      { name: 'selector', type: 'string', required: false, default: '', description: '动态读取模型名的选择器。' },
      { name: 'includeTypes', type: 'string[]', required: false, default: [], description: '只包含指定字段类型。' },
      { name: 'excludeTypes', type: 'string[]', required: false, default: ['object', 'array', 'void'], description: '排除指定字段类型。' },
      { name: 'includeContainers', type: 'boolean', required: false, default: false, description: '是否包含 object/array/void 这类容器字段。' },
      { name: 'valueMode', type: 'key|name', required: false, default: 'key', description: 'value 输出字段 key 还是完整路径。' },
    ],
  },
});

export default schemaFieldOptions;
