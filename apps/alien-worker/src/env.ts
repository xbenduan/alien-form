/// <reference types="@cloudflare/workers-types" />

/** Worker 运行时绑定。DB 为 D1，ASSETS 为 alien-mdm 打包产物的静态资源。 */
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** 关闭开发期人为延时（与 Node 版一致，默认非 production 不延时）。 */
  API_DELAY?: string;
  ENVIRONMENT?: string;
}
