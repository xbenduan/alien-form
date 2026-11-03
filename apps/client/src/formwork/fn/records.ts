import { FormworkError } from "formwork";
import type { ActionContext, JsonValue } from "formwork";
import { escapePointer, isObject, pointerSegments, resolveFieldSchema } from "formwork/model";
import type { FieldSchema, ModelDocument, RecordPage, RecordQuery } from "formwork/model";
export type { RecordPage, RecordQuery } from "formwork/model";

const target = (ctx: ActionContext) => {
  if (!ctx.modelId) throw new FormworkError("PARAMS_REQUIRED", "记录操作需要 modelId");
  return ctx.modelId;
};
function creationValue(source: FieldSchema, value: JsonValue, document: ModelDocument): JsonValue {
  const schema = resolveFieldSchema(source, document);
  if (isObject(value) && schema.properties)
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, child]) => {
        const field = schema.properties![key] ?? schema.additionalProperties;
        return field && !resolveFieldSchema(field, document).readOnly
          ? [[key, creationValue(field, child as JsonValue, document)]]
          : [];
      }),
    );
  if (Array.isArray(value) && schema.items)
    return value.map((child) => creationValue(schema.items!, child, document));
  return value;
}
/** 按路由 modelId 查询授权记录，Domain 返回的 schema 不改变后端目标。 */
export async function queryRecords(ctx: ActionContext, query: RecordQuery): Promise<RecordPage> {
  return ctx.api.records.query(target(ctx), query, { signal: ctx.signal });
}
/** 装载当前树模型的授权记录，由树页面组织节点。 */
export async function loadTreeRecords(ctx: ActionContext) {
  if (!ctx.schema?.tree) throw new FormworkError("INVALID_MODEL", "树形列表需要 tree 字段描述");
  return ctx.api.records.subtree(
    target(ctx),
    { parentField: pointerSegments(ctx.schema.tree.parentField)[0]! },
    { signal: ctx.signal },
  );
}
/** 按当前 Window 捕获的记录 id 装载授权记录。 */
export async function loadRecord(ctx: ActionContext) {
  if (!ctx.params.id) throw new FormworkError("PARAMS_REQUIRED", "记录加载需要 id");
  const record = await ctx.api.records.read(target(ctx), ctx.params.id, { signal: ctx.signal });
  if (!ctx.schema) throw new FormworkError("INVALID_MODEL", "记录页面需要已加载的 schema");
  // API 的服务端 metadata 不一定在表单 schema 中；隐藏值由 Worker 合并保留。
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => Object.hasOwn(ctx.schema!.data, key)),
  );
}
/** 排除数据只读字段后创建或更新记录，由后端补入默认值并保留已有只读值。 */
export async function saveRecord(
  ctx: ActionContext,
  value: JsonValue | undefined,
  original?: JsonValue,
) {
  if (!isObject(value)) throw new FormworkError("INVALID_VALUE", "记录必须是 object");
  if (!ctx.schema) throw new FormworkError("INVALID_MODEL", "记录页面需要已加载的 schema");
  const data = ctx.schema.data;
  const input = Object.fromEntries(
    Object.entries(value).filter(([key]) => {
      const schema = data[key];
      return (
        schema &&
        !resolveFieldSchema(schema, ctx.schema!).readOnly &&
        (!isObject(original) || JSON.stringify(original[key]) !== JSON.stringify(value[key]))
      );
    }),
  ) as Record<string, JsonValue>;
  return ctx.params.id
    ? ctx.api.records.patch(
        target(ctx),
        ctx.params.id,
        {
          set: input,
          unset: isObject(original)
            ? Object.keys(original)
                .filter(
                  (key) =>
                    data[key] &&
                    !resolveFieldSchema(data[key], ctx.schema!).readOnly &&
                    !Object.hasOwn(value, key),
                )
                .map((key) => `/${escapePointer(key)}`)
            : [],
        },
        {
          signal: ctx.signal,
        },
      )
    : ctx.api.records.create(
        target(ctx),
        creationValue({ type: "object", properties: data }, input, ctx.schema) as Record<
          string,
          JsonValue
        >,
        {
          signal: ctx.signal,
        },
      );
}
/** 删除指定授权记录；列表成功后刷新当前查询。 */
export async function removeRecord(ctx: ActionContext, id: string): Promise<{ deleted: true }> {
  return ctx.api.records.delete(target(ctx), id, { signal: ctx.signal });
}
