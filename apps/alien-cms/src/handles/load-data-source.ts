import type { RuntimeRuleContext } from "@alien-form/react";
import { listRecords } from "../services";

/**
 * loadDataSource：从其他模型加载选项数据源。
 * 运行参数来自字段的 x-handler-params.dataSource（构建模型时写入）：
 *   { model, value?, label? }
 */
export async function loadDataSource(ctx: RuntimeRuleContext) {
  const schema = ctx.schema as {
    "x-handler-params"?: Record<string, Record<string, unknown>>;
  };
  const params = schema["x-handler-params"]?.dataSource ?? {};
  const model = typeof params.model === "string" ? params.model : "";
  if (!model) return [];

  const valueKey = typeof params.value === "string" && params.value ? params.value : "id";
  const labelKey = typeof params.label === "string" && params.label ? params.label : valueKey;

  const { list } = await listRecords({ model, pagination: { current: 1, pageSize: 1000 } });
  return list.map((item) => ({
    value: item[valueKey],
    label: String(item[labelKey] ?? item[valueKey] ?? ""),
  }));
}
