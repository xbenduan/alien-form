import { defineWindow } from "formwork";
import { RecordDetail } from "./record-detail";

/** 定义加载完整记录的只读详情窗口。 */
export default defineWindow({
  path: "detail/:id",
  openMode: "page",
  readOnly: true,
  container: RecordDetail,
  getValue: (ctx) => ctx.fn.loadRecord(),
});
