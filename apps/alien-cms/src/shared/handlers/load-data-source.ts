import { defineHandler } from "@alien-form/cms";
import { getHandlerConfig, type HandlerConfigContext } from "../utils/get-handler-config";

const loadDataSource = (ctx: HandlerConfigContext)=> {
  const { schema, key } = ctx;
  const config = getHandlerConfig<any>({
    schema,
    key,
  });

  console.log("debugger", config, ctx);
}

export default defineHandler({
  function: loadDataSource,
  config: {
    key: 'loadDataSource',
    label: 'Load Data Source',
    description: 'Load data source from a model.',
    supportedTargets: ['dataSource'],
    defaultConfig: { model: '' },
    params: [
      { name: 'model', type: 'string', required: false, default: '', description: '固定模型名。' },
    ],
  },
});