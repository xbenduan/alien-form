/**
 * Declarative route configuration.
 *
 * All route metadata (path, component, menu placement, icon, layout behavior)
 * is defined here. The sidebar and router are auto-generated from this config.
 */
import { lazy } from "react";
import type { ReactNode } from "react";
import {
  AppstoreOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  SettingOutlined,
} from "../../shared/ui";

// ─── Types ───────────────────────────────────────────────────

export type MenuGroup = "system" | "models" | "none";

export interface RouteMenuMeta {
  /** Which sidebar menu group this route belongs to */
  group: MenuGroup;
  /** Menu item label */
  label: string;
  /** Menu item icon */
  icon?: ReactNode;
  /** Sort order within the group (lower = higher) */
  order?: number;
}

export interface RouteMeta {
  /** Route path (relative to root) */
  path: string;
  /** Unique key used for menu selection highlighting */
  key: string;
  /** Menu configuration. If undefined, route is hidden from menus. */
  menu?: RouteMenuMeta;
  /** Lazy-loaded component */
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  /** Additional props passed to the component */
  props?: Record<string, any>;
  /** Child routes (for nested dynamic routes like records/:modelName/edit/:id) */
  children?: RouteMeta[];
}

// ─── Lazy Components ─────────────────────────────────────────

const ModelManagementPage = lazy(() => import("../../domains/model/pages/ModelManagementPage"));
const ModelPage = lazy(() => import("../../domains/model/pages/ModelPage"));
const SystemSettingsPage = lazy(() => import("../../domains/system/pages/SystemSettingsPage"));
const LogPage = lazy(() => import("../../domains/system/pages/LogPage"));
const AboutPage = lazy(() => import("../../domains/system/pages/AboutPage"));
const RecordPage = lazy(() => import("../../domains/record/pages/RecordPage"));
const RecordActionPage = lazy(() => import("../../domains/record/pages/RecordActionPage"));

// ─── Route Definitions ───────────────────────────────────────

/**
 * System-level routes with static paths.
 * These appear in the "系统菜单" section of the sidebar.
 */
export const staticRoutes: RouteMeta[] = [
  {
    path: "models",
    key: "models",
    menu: {
      group: "system",
      label: "模型管理",
      icon: <AppstoreOutlined />,
      order: 1,
    },
    component: ModelManagementPage,
  },
  {
    path: "system/logs",
    key: "system-logs",
    menu: {
      group: "system",
      label: "操作日志",
      icon: <FileTextOutlined />,
      order: 2,
    },
    component: LogPage,
  },
  {
    path: "system/settings",
    key: "system-settings",
    menu: {
      group: "system",
      label: "系统设置",
      icon: <SettingOutlined />,
      order: 3,
    },
    component: SystemSettingsPage,
  },
  {
    path: "system/about",
    key: "system-about",
    menu: {
      group: "system",
      label: "学习中心",
      icon: <InfoCircleOutlined />,
      order: 4,
    },
    component: AboutPage,
  },
  // Hidden routes (no menu entry)
  {
    path: "models/new",
    key: "models",
    component: ModelPage,
  },
  {
    path: "models/:modelName/edit",
    key: "models",
    component: ModelPage,
  },
];

/**
 * Record routes — dynamically derived from model list.
 * These appear in the "模型列表" section of the sidebar.
 */
export const recordRoutes: RouteMeta[] = [
  {
    path: "records/:modelName",
    key: "record-list",
    menu: {
      group: "models",
      label: "", // Dynamic: resolved from model summary at render time
      order: 0,
    },
    component: RecordPage,
    props: { routeAction: { mode: "closed" }, pageType: "list" },
  },
  {
    path: "records/:modelName/add",
    key: "record-action",
    component: RecordActionPage,
    props: { routeAction: { mode: "add" }, pageType: "action" },
  },
  {
    path: "records/:modelName/edit/:recordId",
    key: "record-action",
    component: RecordActionPage,
    props: { routeAction: { mode: "edit" }, pageType: "action" },
  },
  {
    path: "records/:modelName/detail/:recordId",
    key: "record-action",
    component: RecordActionPage,
    props: { routeAction: { mode: "detail" }, pageType: "action" },
  },
];

// ─── Helpers ─────────────────────────────────────────────────

/** Get all routes that should appear in a specific menu group */
export function getMenuRoutes(group: MenuGroup): RouteMeta[] {
  return staticRoutes
    .filter((r) => r.menu?.group === group)
    .sort((a, b) => (a.menu?.order ?? 99) - (b.menu?.order ?? 99));
}

/** Resolve the active sidebar key from the current pathname */
export function resolveActiveKey(pathname: string): string {
  if (pathname === "/models" || pathname.startsWith("/models/")) {
    return "models";
  }
  if (pathname === "/system/logs") {
    return "system-logs";
  }
  if (pathname === "/system/about") {
    return "system-about";
  }
  if (pathname === "/system/settings" || pathname.startsWith("/system/")) {
    return "system-settings";
  }
  if (pathname.startsWith("/records/")) {
    return decodeURIComponent(pathname.split("/")[2] ?? "");
  }
  return "";
}
