import type { Context } from "hono";
import type { ApiEnvelope } from "@alien-form/protocol";
import type { AppEnv } from "../env.ts";

type StatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 405 | 409 | 500;

/** 成功信封：data 携带业务负载，msg 默认空串。 */
export function ok<T>(c: Context<AppEnv>, data: T, status: StatusCode = 200, msg = ""): Response {
  const body: ApiEnvelope<T> = { status: "success", msg, data };
  return c.json(body, status);
}

/** 失败信封：data 恒为 null，msg 为错误原因。 */
export function fail(c: Context<AppEnv>, msg: string, status: StatusCode): Response {
  const body: ApiEnvelope<null> = { status: "error", msg, data: null };
  return c.json(body, status);
}
