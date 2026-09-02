import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export interface RouteMeta {
  path: string;
  component: LazyExoticComponent<ComponentType>;
}

const HomePage = lazy(() => import("../../pages/home"));
const LoginPage = lazy(() => import("../../pages/auth/login"));
const ModelListPage = lazy(() => import("../../pages/model/list"));
const ModelAddPage = lazy(() => import("../../pages/model/add"));
const ModelCopyPage = lazy(() => import("../../pages/model/copy"));
const ModelEditPage = lazy(() => import("../../pages/model/edit"));

export const publicRoutes: RouteMeta[] = [{ path: "/login", component: LoginPage }];

export const staticRoutes: RouteMeta[] = [
  { path: "/", component: HomePage },
  { path: "/models", component: ModelListPage },
  { path: "/models/list", component: ModelListPage },
  { path: "/models/add", component: ModelAddPage },
  { path: "/models/:modelCode/copy", component: ModelCopyPage },
  { path: "/models/:modelCode/edit", component: ModelEditPage },
];
