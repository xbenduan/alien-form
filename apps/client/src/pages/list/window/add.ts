import { defineWindow } from "formwork";
import { RecordEditor } from "./record-editor";

/** 定义应用模型默认值的新建窗口，schema 可覆盖打开方式。 */
export default defineWindow({ path: "add", openMode: "modal", container: RecordEditor });
