import { FormworkError } from "formwork/model";

/** 为统一错误 DTO 附加 HTTP 状态，不暴露数据库内部错误。 */
export class ServiceError extends FormworkError {
  constructor(
    code: string,
    message: string,
    readonly status: number,
    issues: ConstructorParameters<typeof FormworkError>[2] = [],
    currentRevision?: string,
  ) {
    super(code, message, issues, currentRevision);
  }
}
/** 拒绝不满足请求约束的输入。 */
export function invalid(message: string): never {
  throw new ServiceError("INVALID_INPUT", message, 400);
}
/** 拒绝无权访问的操作。 */
export function forbidden(message = "没有执行此操作的权限"): never {
  throw new ServiceError("FORBIDDEN", message, 403);
}
/** 报告不存在的模型或记录。 */
export function notFound(message: string): never {
  throw new ServiceError("NOT_FOUND", message, 404);
}
