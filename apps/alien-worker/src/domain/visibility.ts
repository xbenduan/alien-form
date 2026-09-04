import type { ModelRecord } from "@alien-form/validate";

/** 用户模型标识（登录、账号管理的内置模型）。 */
export const USER_MODEL = "_sys_user";

/**
 * 敏感字段脱敏策略：按模型声明对外不可见的字段，出参前统一抹除。
 * 收口在此，避免 auth / records 各写一份 delete 逻辑。
 */
const SENSITIVE_FIELDS: Record<string, ReadonlySet<string>> = {
  [USER_MODEL]: new Set(["passwordHash"]),
};

/** 抹除某模型记录里的敏感字段（返回浅拷贝，原对象不动）。 */
export function publicRecord(model: string, record: ModelRecord): ModelRecord {
  const sensitive = SENSITIVE_FIELDS[model];
  if (!sensitive) return record;
  const result = { ...record };
  for (const field of sensitive) delete result[field];
  return result;
}
