import { lazy } from "react";
import type { ModelPageScene } from "../../runtime/react";

/** 路由动作模式：新增 / 编辑 / 详情。 */
export type ActionMode = Exclude<ModelPageScene, "list">;

const HomePage = lazy(() => import("../../domains/homepage/pages/index"));
const LoginPage = lazy(() => import("../../domains/auth/pages/login"));
const ModelListPage = lazy(() => import("../../domains/model/pages/list"));
const ModelActionPage = lazy(() => import("../../domains/model/pages/actions"));
const RecordPage = lazy(() => import("./record-route"));

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
  { path: "/records/:modelName", component: RecordPage, props: { scene: "list" } },
  { path: "/records/:modelName/add", component: RecordPage, props: { scene: "add" } },
  {
    path: "/records/:modelName/edit/:recordId",
    component: RecordPage,
    props: { scene: "edit" },
  },
  {
    path: "/records/:modelName/detail/:recordId",
    component: RecordPage,
    props: { scene: "detail" },
  },
];

export const publicRoutes: RouteMeta[] = [{ path: "/login", component: LoginPage }];
