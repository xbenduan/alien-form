import { definePage } from "formwork";
import { LegacyWindow } from "./content";

const add = definePage({ router: "legacy-add", path: "/add/:modelId", render: LegacyWindow });
const edit = definePage({
  router: "legacy-edit",
  path: "/edit/:modelId/:id",
  render: LegacyWindow,
});
const detail = definePage({
  router: "legacy-detail",
  path: "/detail/:modelId/:id",
  render: LegacyWindow,
});

/** 注册历史全局 Window URL 的显式迁移入口。 */
export const legacyWindows = [add, edit, detail];
