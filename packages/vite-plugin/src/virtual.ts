import type { ModelSnapshot } from "formwork/model";
import type { FormworkAnalysis } from "./analyze";

/** 打包静态能力描述，按模型和 router 选择已解析的有效覆盖。 */
export function capabilitiesVirtualModule(analysis: FormworkAnalysis): string {
  const forRouter = (modelId: string) =>
    Object.fromEntries(
      analysis.routes.map(({ router }) => [router, analysis.capabilities(modelId, router)]),
    );
  return `import {FormworkError,modelIdPattern} from "formwork/model";
const defaults=${JSON.stringify(forRouter(""))};
const domains=${JSON.stringify(Object.fromEntries(analysis.domainIds.map((id) => [id, forRouter(id)])))};
/** 提供静态路由；只导入此项时可以移除未使用的能力声明。 */
export const routes=${JSON.stringify(analysis.routes)};
/** 查询指定模型和 router 的有效组件、fn 与覆盖元信息。 */
export function capabilities(modelId,router){
  if(!modelIdPattern.test(modelId))throw new FormworkError("INVALID_MODEL","无效 modelId");
  if(!Object.hasOwn(defaults,router))throw new FormworkError("UNKNOWN_ROUTER","未知 router "+router);
  const entry=domains[modelId]?.[router] ?? defaults[router];
  return {...entry,modelId,runtimeChecks:entry.runtimeChecks.map(item=>({...item,modelId}))};
}
export default {routes,capabilities};`;
}

/** 生成保持对象身份的开发代理或构建期完整只读源。 */
export function modelVirtualModule(development: boolean, snapshots: readonly ModelSnapshot[]) {
  if (!development)
    return `import {createReadonlyModelSource} from "formwork/model";export default createReadonlyModelSource(${JSON.stringify(snapshots)});`;
  return `import {createHttpModelSource} from "formwork/model";
const source=import.meta.hot?.data.source ?? createHttpModelSource({url:"/__formwork/models"});
export default source;
if(import.meta.hot){
  import.meta.hot.data.source=source;
  const update=(detail)=>window.dispatchEvent(new CustomEvent("formwork:model-update",{detail}));
  import.meta.hot.on("formwork:model-update",update);
  import.meta.hot.accept();
  import.meta.hot.dispose(()=>import.meta.hot.off("formwork:model-update",update));
}`;
}
