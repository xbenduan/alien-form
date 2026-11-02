import { defineFormwork } from "formwork";
import home from "../pages/home";
import login from "../pages/login";
import tokens from "../pages/api-tokens";
import workbench from "../pages/models";
import preview from "../pages/model-preview";
import list from "../pages/list";
import treeList from "../pages/tree-list";
import { legacyWindows } from "../pages/legacy-window";
import { api } from "./api";
import { modelDefaults } from "./defaults";
import { PagePresenter } from "./presenters/page";
import { DrawerPresenter } from "./presenters/drawer";
import { ModalPresenter } from "./presenters/modal";

/** 显式装配框架能力、Page、Domain 与三种 Window 呈现方式。 */
export default defineFormwork({
  ...modelDefaults,
  api,
  pages: [home, login, tokens, workbench, preview, list, treeList, ...legacyWindows],
  presenters: { page: PagePresenter, modal: ModalPresenter, drawer: DrawerPresenter },
});
