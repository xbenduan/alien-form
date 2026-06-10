import { defineHandler, listRecords } from "@alien-form/cms";

export default defineHandler(
  async (ctx) => {
    const params = ctx.schema?.["x-cms"]?.reactions?.dataSource || {};
    if (!params.model) return [];
    const data = await listRecords({ model: params.model });
    if (!data?.list?.length) return [];
    return data.list.map((item) => ({ value: item[params.value], label: item[params.label] }));
  },
  {
    key: "loadDataSource",
    label: "加载数据源",
    description: "从模型加载数据源。",
    supportedTargets: ["dataSource"],
    defaultConfig: { model: "" },
    params: [
      { name: "model", type: "string", required: false, default: "", description: "固定模型名。" },
      {
        name: "value",
        type: "string",
        required: false,
        default: "",
        description: "要获取的值的 key",
      },
      {
        name: "label",
        type: "string",
        required: false,
        default: "",
        description: "要获取的名的 key",
      },
    ],
  },
);
