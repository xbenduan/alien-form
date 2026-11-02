import { definePage } from "formwork";
import { Home } from "./content";

/** 定义无需模型上下文的首页。 */
export default definePage({ router: "home", path: "/home", render: Home });
