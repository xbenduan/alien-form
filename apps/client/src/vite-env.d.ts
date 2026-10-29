/// <reference types="vite/client" />

declare module "virtual:formwork/capabilities" {
  /** 读取静态路由，不引入未使用的能力声明。 */
  export const routes: readonly import("formwork/model").RouteDefinition[];
  /** 查询有效组件、fn、覆盖来源与声明。 */
  export function capabilities(
    modelId: string,
    router: string,
  ): import("formwork/mcp").EffectiveCapabilities;
  const description: {
    routes: typeof routes;
    capabilities: typeof capabilities;
  };
  export default description;
}
