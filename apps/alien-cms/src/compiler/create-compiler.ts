import { SchemaCompiler } from "@alien-form/shared";
import type { RequestInput, RequestResult } from "@alien-form/shared";
import { getSchema, listRecords } from "../services";

/**
 * 应用级 request：把 SchemaCompiler / 组件 service 的数据请求接到 services 层。
 * 编译期预取外键、组件 props 方案自取都走这一个入口。
 */
export const appRequest = async (input: RequestInput): Promise<RequestResult> => {
  const { list, total } = await listRecords({
    model: input.model,
    filters: input.filters,
    pagination: input.pagination,
  });
  return { list, total };
};

/**
 * 新建一个 SchemaCompiler 实例。
 * 每个 domain 页面建一个、退出销毁；locale 变化重建（locale 作为构造入参）。
 */
export function createAppCompiler(locale = "zh"): SchemaCompiler {
  return new SchemaCompiler({
    request: appRequest,
    loadSchema: (modelCode) => getSchema(modelCode),
    locale,
  });
}
