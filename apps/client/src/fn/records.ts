import { FormworkError } from "formwork";
import type { ActionContext, JsonValue } from "formwork";
import { isObject } from "formwork/model";
import type { RecordPage, RecordQuery } from "formwork/model";
export type { RecordPage, RecordQuery } from "formwork/model";

const target = (ctx: ActionContext) => {
  if (!ctx.domain) throw new FormworkError("PARAMS_REQUIRED", "记录操作需要 domain");
  return ctx.domain;
};
/** 按路由 modelId 查询授权记录，Domain 返回的 schema 不改变后端目标。 */
export async function queryRecords(ctx: ActionContext, query: RecordQuery): Promise<RecordPage> {
  return ctx.api.records.query(target(ctx), query, { signal: ctx.signal });
}
/** 按当前 Window 捕获的记录 id 装载授权记录。 */
export async function loadRecord(ctx: ActionContext) {
  if (!ctx.params.id) throw new FormworkError("PARAMS_REQUIRED", "记录加载需要 id");
  const record = await ctx.api.records.read(target(ctx), ctx.params.id, { signal: ctx.signal });
  if (!ctx.schema) throw new FormworkError("INVALID_MODEL", "记录页面需要已加载的 schema");
  // API 的服务端 metadata 不一定在表单 schema 中；隐藏值由 Worker 合并保留。
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => Object.hasOwn(ctx.schema!.data.properties, key)),
  );
}
/** 创建或更新记录，后端合并隐藏字段并校验最新发布 schema。 */
export async function saveRecord(ctx: ActionContext, value: JsonValue | undefined) {
  if (!isObject(value)) throw new FormworkError("INVALID_VALUE", "记录必须是 object");
  return ctx.params.id
    ? ctx.api.records.update(target(ctx), ctx.params.id, value as Record<string, JsonValue>, {
        signal: ctx.signal,
      })
    : ctx.api.records.create(target(ctx), value as Record<string, JsonValue>, {
        signal: ctx.signal,
      });
}
/** 删除指定授权记录；列表成功后刷新当前查询。 */
export async function removeRecord(ctx: ActionContext, id: string): Promise<{ deleted: true }> {
  return ctx.api.records.delete(target(ctx), id, { signal: ctx.signal });
}
