import type { ModelRecord, ModelSchema, OpenMode } from "../../../runtime";

export type { ModelRecord, ModelSchema, OpenMode };

/** 记录动作模式：列表页无动作时为 closed。 */
export type RecordActionMode = "closed" | "add" | "edit" | "detail";

/** 叠加层（drawer / modal）动作状态。 */
export interface OverlayActionState {
  mode: Exclude<RecordActionMode, "closed">;
  openMode: Exclude<OpenMode, "page">;
  recordId?: string;
}
