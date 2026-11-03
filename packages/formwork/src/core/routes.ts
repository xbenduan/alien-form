import { FormworkError } from "../model/errors";

/** 解析 Domain 的固定操作后缀，不从业务分类推断路由。 */
export function parseLocation(pathname: string) {
  let parts: string[];
  try {
    parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    throw new FormworkError("INVALID_ROUTE", "地址包含非法编码");
  }
  const [router, modelId, mode, recordId] = parts;
  if (
    mode &&
    (!["detail", "create", "edit"].includes(mode) ||
      (mode === "create" ? parts.length !== 3 : !recordId || parts.length !== 4))
  )
    throw new FormworkError("NOT_FOUND", "未知记录操作地址");
  return {
    router: router ?? "home",
    modelId,
    mode: mode as "detail" | "create" | "edit" | undefined,
    recordId,
  };
}
/** 对每个身份段编码后构造记录地址。 */
export function recordPath(router: string, modelId: string, mode?: string, recordId?: string) {
  return (
    "/" +
    [router, modelId, mode, recordId]
      .filter((part) => part !== undefined)
      .map((part) => {
        if (!part || part === "." || part === "..")
          throw new FormworkError("INVALID_ROUTE", "非法路径段");
        return encodeURIComponent(part);
      })
      .join("/")
  );
}
