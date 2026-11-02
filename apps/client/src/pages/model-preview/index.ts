import { definePage } from "formwork";
import { ModelPreview } from "./content";

/** 定义共享草稿与已发布版本的模型预览画布。 */
export default definePage({ router: "model-preview", path: "/model-preview/:modelId", render: ModelPreview });
