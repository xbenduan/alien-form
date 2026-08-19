import type { SchemaHandlers } from "@alien-form/shared";
import { loadDataSource } from "./load-data-source";

/**
 * 全局 handler 注册表：构建模型（schema 配置）与渲染表单（x-reaction）共用同一份。
 * 通过 @handlerName 在 schema 中引用。
 */
export const handles = {
  loadDataSource,
} satisfies SchemaHandlers;

/** 可在模型构建器中选择的 handler 元信息。 */
export const handlerOptions = [
  {
    value: "loadDataSource",
    label: "从其他模型加载数据源",
    description: "根据 model / value / label 参数拉取选项。",
  },
];
