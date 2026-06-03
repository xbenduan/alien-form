import { defineHandler } from "@alien-form/cms";

export default defineHandler(
  (ctx) => {
    console.log("debugger", ctx);

    return [{ value: "test", label: "测试" }];
  },
  {
    key: "loadDataSource",
    label: "Load Data Source",
    description: "Load data source from a model.",
    supportedTargets: ["dataSource"],
    defaultConfig: { model: "" },
    params: [
      { name: "model", type: "string", required: false, default: "", description: "固定模型名。" },
    ],
  },
);
