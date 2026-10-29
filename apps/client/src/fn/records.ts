import { FormworkError } from "formwork";
import type { ActionContext, JsonValue } from "formwork";
import { isObject } from "formwork/model";

/** 保存列表提交后的查询参数，filters 只包含已提交的草稿快照。 */
export type RecordQuery = { filters: Record<string, JsonValue>; page: number; pageSize: number; sort?: { field: string; direction: "asc" | "desc" } };
/** 返回分页记录和符合条件的总数。 */
export type RecordPage = { list: Record<string, JsonValue>[]; total: number };
const base = (ctx: ActionContext) => {
  if (!ctx.domain) throw new FormworkError("PARAMS_REQUIRED", "记录操作需要 domain");
  return `/api/records/${encodeURIComponent(ctx.domain)}`;
};
async function request(ctx: ActionContext, path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, { method, signal: ctx.signal, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new FormworkError(result.error?.code ?? "HTTP_ERROR", result.error?.message ?? `HTTP ${response.status}`, result.error?.issues ?? []);
  return result;
}
/** 按当前模型查询完整记录。 */
export async function queryRecords(ctx: ActionContext, query: RecordQuery): Promise<RecordPage> { return request(ctx, `${base(ctx)}/query`, "POST", query); }
/** 按当前 Window 捕获的记录 id 装载完整记录。 */
export async function loadRecord(ctx: ActionContext): Promise<Record<string, JsonValue>> {
  if (!ctx.params.id) throw new FormworkError("PARAMS_REQUIRED", "记录加载需要 id");
  return request(ctx, `${base(ctx)}/${encodeURIComponent(ctx.params.id)}`);
}
/** 创建或完整更新记录，成功值交给 Window.complete 返回调用者。 */
export async function saveRecord(ctx: ActionContext, value: JsonValue | undefined): Promise<Record<string, JsonValue>> {
  if (!isObject(value)) throw new FormworkError("INVALID_VALUE", "记录必须是 object");
  return request(ctx, `${base(ctx)}${ctx.params.id ? `/${encodeURIComponent(ctx.params.id)}` : ""}`, ctx.params.id ? "PUT" : "POST", value);
}
/** 删除指定记录；列表在成功后刷新当前查询。 */
export async function removeRecord(ctx: ActionContext, id: string): Promise<{ deleted: true }> { return request(ctx, `${base(ctx)}/${encodeURIComponent(id)}`, "DELETE"); }
