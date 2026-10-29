import { definePage, defineWindow } from "formwork";
import { loadPublishedSchema } from "./models";
import { List } from "./pages/list-content";
import { RecordDetail, RecordEditor } from "./pages/record-content";

const domains = { cms: () => import("./domains/cms") };
/** 配置普通记录列表的已发布 schema 加载。 */
export const list = definePage({
  router: "list",
  path: "/list/:domain",
  getSchema: loadPublishedSchema,
  container: List,
  domains,
});
/** 配置新建记录 Window 的已发布 schema 加载。 */
export const add = defineWindow({
  router: "add",
  path: "/add/:domain",
  presentation: "modal",
  returnTo: "list",
  getSchema: loadPublishedSchema,
  container: RecordEditor,
  domains,
});
/** 配置编辑记录 Window 的已发布 schema 加载。 */
export const edit = defineWindow({
  router: "edit",
  path: "/edit/:domain/:id",
  presentation: "modal",
  returnTo: "list",
  getSchema: loadPublishedSchema,
  container: RecordEditor,
  domains,
});
/** 配置记录详情 Window 的已发布 schema 加载。 */
export const detail = defineWindow({
  router: "detail",
  path: "/detail/:domain/:id",
  presentation: "drawer",
  returnTo: "list",
  getSchema: loadPublishedSchema,
  container: RecordDetail,
  domains,
});
