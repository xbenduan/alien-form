import type { FormworkAnalysis } from "./analyze";

/** 保留声明层，在拿到模型文档后按 Page 与本地 Window 查询有效能力。 */
export function capabilitiesVirtualModule(analysis: FormworkAnalysis): string {
  return `import {manifestCapabilities} from "formwork/model";
/** 保存构建分析出的显式注册关系。 */
export const catalog=${JSON.stringify({ ...analysis.catalog, appId: "", clientOrigin: "", revision: "" })};
/** 提供 Page 与本地 Window 的结构化路由目录。 */
export const routes=${JSON.stringify(analysis.routes)};
/** 根据实际文档选择 Domain 并合并当前目标的能力。 */
export function capabilities(document,target){return manifestCapabilities(catalog,document,target);}
export default {routes,catalog,capabilities};`;
}
