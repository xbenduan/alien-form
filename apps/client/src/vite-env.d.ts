/// <reference types="vite/client" />

declare module "virtual:formwork/capabilities" {
  /** 读取静态路由，不引入未使用的能力声明。 */
  export const routes: readonly import("formwork/model").RouteDefinition[];
  /** 保存显式注册的能力层和 Page/Window 归属。 */
  export const catalog: import("formwork/model").CapabilityManifest;
  /** 查询有效组件、fn、覆盖来源与声明。 */
  export function capabilities(
    document: Pick<import("formwork/model").ModelDocument, "id" | "domain">,
    target: import("formwork/model").RouteTarget,
  ): import("formwork/mcp").EffectiveCapabilities;
  const description: {
    routes: typeof routes;
    catalog: typeof catalog;
    capabilities: typeof capabilities;
  };
  export default description;
}
