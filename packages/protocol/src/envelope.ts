/**
 * 统一 API 响应信封：所有 /api/v1 接口的响应体都是该结构。
 * HTTP 状态码保留语义（2xx 成功、4xx/5xx 失败），业务负载统一收进 data。
 */
export type ApiStatus = "success" | "error";

export interface ApiEnvelope<T = unknown> {
  status: ApiStatus;
  /** 人类可读的提示信息；成功时可为空串，失败时为错误原因。 */
  msg: string;
  /** 业务负载；失败时为 null。 */
  data: T | null;
}

/** 运行时判断一个值是否为合法信封（供前端解析响应时使用）。 */
export function isApiEnvelope(value: unknown): value is ApiEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    "data" in value &&
    ((value as { status: unknown }).status === "success" ||
      (value as { status: unknown }).status === "error")
  );
}
