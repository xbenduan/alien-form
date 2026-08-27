import type { ModelFieldSchema } from "../schema/types.ts";

/**
 * 每个模型的默认字段：id / status / 审计人与时间。
 *
 * 统一策略：table 默认展示、表单不展示（display: hidden）、filter 展示（filterable）。
 *  - id / createdAt / updatedAt 是后端系统列（仓储自动维护，不建业务列）；
 *  - createBy / updateBy 是普通业务列（落 text 列）；
 *  - status 用 Select，选项取自注册的 status 常量，默认值 normal。
 *
 * 说明：user / course 等模型已有各自语义更丰富的 status 业务字段，沿用它们即可，
 * 不叠加模版 status（用 `withStatus: false` 关闭）。
 */
export function defaultFields(options: { withStatus?: boolean } = {}): Record<
  string,
  ModelFieldSchema
> {
  const { withStatus = true } = options;
  const auditText = (title: string): ModelFieldSchema => ({
    type: "string",
    title,
    component: "Input",
    display: "hidden",
    "x-table": { visible: true, width: 160 },
    "x-database": { type: "text", filterable: true },
  });
  const auditTime = (title: string): ModelFieldSchema => ({
    type: "string",
    title,
    component: "DateInput",
    display: "hidden",
    "x-table": { visible: true, width: 170 },
    "x-database": { type: "text", filterable: true },
  });
  return {
    ...(withStatus
      ? {
          status: {
            type: "string",
            title: "状态",
            component: "Select",
            display: "hidden",
            default: "normal",
            order: 895,
            dataSource: { plugin: "$af-constant", key: "status" },
            "x-table": { visible: true, width: 100 },
            "x-database": { type: "text", default: "normal", index: true, filterable: true },
          },
        }
      : {}),
    createBy: { ...auditText("创建人"), order: 905 },
    updateBy: { ...auditText("更新人"), order: 915 },
    id: {
      type: "string",
      title: "ID",
      display: "hidden",
      order: 900,
      "x-table": { visible: true, width: 160 },
      "x-database": { type: "text", filterable: true },
    },
    createdAt: { ...auditTime("创建时间"), order: 910 },
    updatedAt: { ...auditTime("更新时间"), order: 920 },
  };
}
