import type { FormworkAnalysis } from "./analyze";

/** 提供应用共享能力和显式 Domain/Page 路由的只读模块。 */
export function capabilitiesVirtualModule(analysis: FormworkAnalysis): string {
  return `import {manifestCapabilities} from "formwork/model";
/** 保存构建分析出的显式注册关系。 */
export const catalog=${JSON.stringify({ ...analysis.catalog, appId: "", clientOrigin: "", revision: "" })};
/** 提供 Domain 与 Page 的结构化路由目录。 */
export const routes=${JSON.stringify(analysis.routes)};
/** 根据 router 选择 Domain，schema.domain 仅保留业务分类。 */
export function capabilities(document,target){return manifestCapabilities(catalog,document,target);}
export default {routes,catalog,capabilities};`;
}
