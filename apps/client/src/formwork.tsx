import { defineFormwork, definePage, defineWindow } from "formwork";
import { components } from "./components";
import { models } from "./models";
import { FormItem } from "./ui/field-container";
import { DrawerPresenter, ModalPresenter, PagePresenter } from "./ui/presenters";
import { Home } from "./pages/home";
import { List } from "./pages/list-content";
import { ModelWorkbench } from "./pages/model-workbench";
import { RecordDetail, RecordEditor } from "./pages/record-content";
import * as recordFns from "./fn/records";

const domains = { cms: () => import("./domains/cms") };
const home = definePage({ router: "home", render: Home });
const workbench = definePage({
  router: "models",
  path: "/models/:domain?",
  render: ModelWorkbench,
});
const list = definePage({ router: "list", path: "/list/:domain", container: List, domains });
const add = defineWindow({
  router: "add",
  path: "/add/:domain",
  presentation: "modal",
  returnTo: "list",
  container: RecordEditor,
  domains,
});
const edit = defineWindow({
  router: "edit",
  path: "/edit/:domain/:id",
  presentation: "modal",
  returnTo: "list",
  container: RecordEditor,
  domains,
});
const detail = defineWindow({
  router: "detail",
  path: "/detail/:domain/:id",
  presentation: "drawer",
  returnTo: "list",
  container: RecordDetail,
  domains,
});

/** 装配默认模型、cms 延迟覆盖与完整记录 Window。 */
export default defineFormwork({
  models,
  components,
  fn: recordFns,
  fieldContainer: FormItem,
  pages: [home, workbench, list],
  windows: [add, edit, detail],
  presenters: { page: PagePresenter, modal: ModalPresenter, drawer: DrawerPresenter },
});
