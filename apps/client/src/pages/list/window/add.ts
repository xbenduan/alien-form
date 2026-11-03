import { defineWindow } from "formwork";
import { RecordEditor } from "./record-editor";

/** 定义应用模型默认值的新建窗口，打开方式由页面代码决定。 */
export default defineWindow({ path: "add", openMode: "modal", container: RecordEditor });
