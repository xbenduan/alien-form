import { defineFormwork, definePage } from "formwork";
import { components } from "./components";
import { api } from "./models";
import { FormItem } from "./ui/field-container";
import { DrawerPresenter, ModalPresenter, PagePresenter } from "./ui/presenters";
import { Home } from "./pages/home";
import { ModelWorkbench } from "./pages/model-workbench";
import { Login } from "./pages/login";
import { ApiTokens } from "./pages/api-tokens";
import { ModelPreview } from "./pages/model-preview";
import { add, detail, edit, list } from "./schema-pages";
import * as recordFns from "./fn/records";

const home = definePage({ router: "home", render: Home });
const workbench = definePage({
  router: "models",
  path: "/models/:domain?",
  render: ModelWorkbench,
});
const login = definePage({ router: "login", path: "/login", render: Login });
const tokens = definePage({ router: "tokens", path: "/tokens", render: ApiTokens });
const preview = definePage({
  router: "model-preview",
  path: "/model-preview/:domain",
  render: ModelPreview,
});

/** 装配 Worker API、cms 延迟覆盖与记录 Window。 */
export default defineFormwork({
  api,
  components,
  fn: recordFns,
  fieldContainer: FormItem,
  pages: [home, login, tokens, workbench, preview, list],
  windows: [add, edit, detail],
  presenters: { page: PagePresenter, modal: ModalPresenter, drawer: DrawerPresenter },
});
