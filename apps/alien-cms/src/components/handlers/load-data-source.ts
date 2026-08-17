import { defineHandler } from "@alien-form/shared";
import { listRecords } from "../../data";

export default defineHandler(
  async (ctx) => {
    const schema = ctx.schema as typeof ctx.schema & {
      "x-handler-params"?: Record<string, Record<string, unknown>>;
    };
    const params = schema["x-handler-params"]?.dataSource ?? {};
    const model = typeof params.model === "string" ? params.model : "";
    if (!model) return [];
    const valueKey = typeof params.value === "string" && params.value ? params.value : "id";
    const labelKey = typeof params.label === "string" && params.label ? params.label : valueKey;
    const data = await listRecords({ model });
    if (!data?.list?.length) return [];
    return data.list.map((item) => ({
      value: item[valueKey],
      label: item[labelKey],
    }));
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
