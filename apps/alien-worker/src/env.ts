/// <reference types="@cloudflare/workers-types" />

import type { Session } from "./services/auth/auth-service.ts";
import type { Container } from "./container.ts";

/** Worker 运行时绑定。DB 为 D1，ASSETS 为 alien-mdm 打包产物的静态资源。 */
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

/**
 * Hono context 变量：每请求装配的依赖容器 + 会话（requireSession 后可用）。
 */
export interface AppVariables {
  container: Container;
  session: Session;
}

/** Hono 泛型环境别名，路由/中间件统一引用。 */
export interface AppEnv {
  Bindings: Env;
  Variables: AppVariables;
}
