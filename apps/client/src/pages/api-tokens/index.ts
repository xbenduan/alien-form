import { definePage } from "formwork";
import { ApiTokens } from "./content";

/** 定义当前账号的 API credential 管理页。 */
export default definePage({ router: "tokens", path: "/tokens", render: ApiTokens });
