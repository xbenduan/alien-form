import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export interface RouteMeta {
  path: string;
  title: string;
  component: LazyExoticComponent<ComponentType>;
  superAdminOnly?: boolean;
  navigationKey?: string;
}

const HomePage = lazy(() => import("../../pages/home"));
const LoginPage = lazy(() => import("../../pages/auth/login"));
const ModelListPage = lazy(() => import("../../pages/model/list"));
const ModelEditorRoute = lazy(() => import("../../pages/model/editor-route"));

export const publicRoutes: RouteMeta[] = [{ path: "/login", title: "登录", component: LoginPage }];

export const staticRoutes: RouteMeta[] = [
  { path: "/", title: "首页", component: HomePage, navigationKey: "home" },
  { path: "/models", title: "模型管理", component: ModelListPage, navigationKey: "models" },
  { path: "/models/add", title: "新增模型", component: ModelEditorRoute, superAdminOnly: true },
  {
    path: "/models/:modelCode/copy",
    title: "复制模型",
    component: ModelEditorRoute,
    superAdminOnly: true,
  },
  {
    path: "/models/:modelCode/edit",
    title: "编辑模型",
    component: ModelEditorRoute,
    superAdminOnly: true,
  },
];
