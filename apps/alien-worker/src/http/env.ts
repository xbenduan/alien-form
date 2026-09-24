/// <reference types="@cloudflare/workers-types" />

import type { Session } from "../application/auth/auth-service.ts";
import type { WorkerCore } from "../bootstrap/core.ts";

/**
 * Hono context 变量：每请求 Core 运行时 + 会话（requireSession 后可用）。
 */
export interface AppVariables {
  core: WorkerCore;
  session: Session;
}

/** Hono 泛型环境别名，路由/中间件统一引用。 */
export interface AppEnv {
  Bindings: Env;
  Variables: AppVariables;
}
