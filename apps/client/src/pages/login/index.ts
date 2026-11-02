import { definePage } from "formwork";
import { Login } from "./content";

/** 定义独立登录页。 */
export default definePage({ router: "login", path: "/login", render: Login });
