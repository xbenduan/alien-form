import { definePage } from "formwork";
import { List } from "./content";
import { windows } from "./window";

/** 定义模型列表及其本地新增、编辑和详情窗口。 */
export default definePage({ router: "list", path: "/list/:modelId", container: List, windows });
