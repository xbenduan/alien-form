import { lazy } from "react";

/** 路由动作模式：新增 / 编辑 / 详情。 */
export type ActionMode = "add" | "edit" | "detail";

const HomePage = lazy(() => import("../../domains/homepage/pages/index"));
const ModelListPage = lazy(() => import("../../domains/model/pages/list"));
const ModelActionPage = lazy(() => import("../../domains/model/pages/actions"));
const RecordListPage = lazy(() => import("../../domains/record/pages/list"));
const RecordActionPage = lazy(() => import("../../domains/record/pages/actions"));

export interface RouteMeta {
  path: string;
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  props?: Record<string, unknown>;
}

/** 应用路由表。 */
export const routes: RouteMeta[] = [
  { path: "/", component: HomePage },
  { path: "/models", component: ModelListPage },
  { path: "/models/list", component: ModelListPage },
  { path: "/models/add", component: ModelActionPage, props: { mode: "add" } },
  { path: "/models/:modelName/edit", component: ModelActionPage, props: { mode: "edit" } },
  { path: "/records/:modelName", component: RecordListPage },
  { path: "/records/:modelName/add", component: RecordActionPage, props: { mode: "add" } },
  {
    path: "/records/:modelName/edit/:recordId",
    component: RecordActionPage,
    props: { mode: "edit" },
  },
  {
    path: "/records/:modelName/detail/:recordId",
    component: RecordActionPage,
    props: { mode: "detail" },
  },
];
