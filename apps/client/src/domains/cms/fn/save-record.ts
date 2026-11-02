import type { ActionContext, JsonValue } from "formwork";
import { isObject } from "formwork/model";
import { saveRecord } from "../../../formwork/fn/records";

/** 按当前 modelId 保存内容，去除标题首尾空白。 */
export function saveCmsRecord(ctx: ActionContext, value: JsonValue | undefined) {
  return saveRecord(ctx, isObject(value) && typeof value.title === "string"
    ? ({ ...value, title: value.title.trim() } as JsonValue) : value);
}
