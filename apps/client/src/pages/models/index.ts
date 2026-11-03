import { definePage } from "formwork";
import { Models } from "./content";

/** 定义模型管理目录和可选模型详情。 */
export default definePage({ router: "models", render: Models });
