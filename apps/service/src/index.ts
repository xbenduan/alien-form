import { createApp } from "./app";
import type { Env } from "./contracts";

const app = createApp();
/** 通过 module Worker 入口处理 HTTP，请求状态仅保存在 D1。 */
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
