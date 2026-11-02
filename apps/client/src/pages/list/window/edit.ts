import { defineWindow } from "formwork";
import { RecordEditor } from "./record-editor";

/** 定义重新加载完整记录并编辑独立草稿的窗口。 */
export default defineWindow({
  path: "edit/:id",
  openMode: "modal",
  container: RecordEditor,
  getValue: (ctx) => ctx.fn.loadRecord(),
});
