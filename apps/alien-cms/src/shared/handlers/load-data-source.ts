import { defineHandler, listRecords } from "@alien-form/cms";

export default defineHandler(
  async (ctx) => {
    const params = ctx.schema?.["x-cms"]?.reactions?.dataSource || {};
    if (!params.model) return [];
    const data = await listRecords({ model: params.model });
    if (!data?.list?.length) return [];
    const mapped = data.list.map((item) => ({ value: item[params.value], label: item[params.label] }));
    return mapped;
  },
  {
    key: "loadDataSource",
    label: "从其他模型加载数据源",
    description: "从其他模型加载数据源。",
    supportedTargets: ["dataSource"],
    defaultConfig: { model: "" },
    params: [
      { name: "model", type: "string", required: true, default: "", description: "模型名称" },
      {
        name: "value",
        type: "string",
        required: false,
        default: "id",
        description: "值字段名（默认值为 id）",
      },
      {
        name: "label",
        type: "string",
        required: false,
        default: "",
        description: "标签字段名",
      },
    ],
  },
);
