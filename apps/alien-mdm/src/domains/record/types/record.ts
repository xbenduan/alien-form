import type { ModelRecord } from "../../../runtime";
import type { ModelSchema, OpenMode } from "../../../compiler/shared";

export type { ModelRecord, ModelSchema, OpenMode };

export type RecordActionMode = "closed" | "add" | "edit" | "detail";

export interface OverlayActionState {
  mode: Exclude<RecordActionMode, "closed">;
  openMode: Exclude<OpenMode, "page">;
  recordId?: string;
}
