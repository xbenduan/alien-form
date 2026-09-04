/**
 * 应用级错误：携带 HTTP 状态码。服务层抛出，http 层的 onError 统一映射为响应，
 * 避免在业务代码里到处 `c.json({ error }, 404)`。
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** 404：资源不存在。 */
export function notFound(message: string): AppError {
  return new AppError(message, 404);
}

/** 409：冲突（如同名模型）。 */
export function conflict(message: string): AppError {
  return new AppError(message, 409);
}

/** 401：未认证 / 会话失效。 */
export function unauthorized(message: string): AppError {
  return new AppError(message, 401);
}

/** 403：禁止操作（如删除超级管理员）。 */
export function forbidden(message: string): AppError {
  return new AppError(message, 403);
}
