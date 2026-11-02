import { definePage } from "formwork";
import { TreeList } from "./content";
import { windows } from "../list/window";

/** 定义树形列表，复用记录窗口并保持独立路由归属。 */
export default definePage({ router: "tree-list", path: "/tree-list/:modelId", container: TreeList, windows });
