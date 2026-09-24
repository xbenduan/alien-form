import { createMiddleware } from "hono/factory";
import { createCore, initializeCore } from "../../bootstrap/core.ts";
import type { AppEnv } from "../env.ts";

/**
 * 为每个请求装配独立 Core，并复用 isolate 级初始化结果。
 * 请求完成后通过 waitUntil 异步派发已提交的 Outbox 事件。
 */
export const useCore = createMiddleware<AppEnv>(async (c, next) => {
  const core = createCore({ db: c.env.DB });
  c.set("core", core);
  await initializeCore(core);
  await next();
  c.executionCtx.waitUntil(core.events.dispatchPending());
});
