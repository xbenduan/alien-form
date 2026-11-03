import { defineFormwork } from "formwork";
import { pages } from "../pages";
import { domains } from "../domains";
import { apis } from "./api";
import { components } from "./components";
import { ui } from "./ui";
import { cmsContract } from "../../../../packages/domain-contracts";

/** 显式装配模型 API、应用 UI、Domain 和普通 Page。 */
export default defineFormwork({
  ...cmsContract,
  apis,
  components,
  ui,
  domains,
  pages,
});
