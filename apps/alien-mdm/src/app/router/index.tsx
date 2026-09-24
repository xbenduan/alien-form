import { UnorderedListOutlined } from "@ant-design/icons";
import { Button, Spin, Tooltip, Typography } from "antd";
import { Suspense, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../providers";
import { canManageModels } from "@runtime/user-info";
import { PageBreadcrumb } from "../../components/page-breadcrumb";
import { UserMenu } from "../../components/user-menu";
import { DynamicPage } from "./dynamic-routes";
import { NavigationProvider, useNavigationItems } from "./navigation";
import { publicRoutes, staticRoutes } from "./static-routes";

function Protected({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  return auth.authenticated ? (
    children
  ) : (
    <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  );
}

function ModelManager({ children }: { children: ReactNode }) {
  return canManageModels() ? children : <Navigate to="/" replace />;
}

function AppTopbar() {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-10 flex-none border-b border-white/46 bg-white/24 shadow-[0_2px_8px_rgba(77,93,131,0.035)] backdrop-blur-md">
      <div className="mx-auto flex min-h-17 w-full max-w-360 items-center justify-between px-8 py-2.5 max-[640px]:min-h-16 max-[640px]:px-4 min-[641px]:max-[1100px]:px-6">
        <Link
          className="flex items-center gap-3 text-inherit no-underline focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-[#1677ff] focus-visible:outline-offset-3"
          to="/"
          aria-label="返回首页"
        >
          <span className="grid h-9.5 w-9.5 place-items-center overflow-hidden rounded-md">
            <img src="/favicon.svg" alt="" aria-hidden="true" />
          </span>
          <span>
            <Typography.Text className="block! text-[10px] font-bold leading-[1.4] tracking-[1px] text-[#7b8799] max-[640px]:hidden!">
              CONTENT OPERATIONS
            </Typography.Text>
            <Typography.Title
              level={3}
              className="m-[1px_0_0]! text-[18px]! leading-tight! text-[#172033]!"
            >
              ALIEN MDM
            </Typography.Title>
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <Tooltip title="模型管理">
            <Button
              type="text"
              shape="circle"
              style={{ color: "rgba(0,0,0,0.88)" }}
              icon={<UnorderedListOutlined />}
              aria-label="模型管理"
              onClick={() => navigate("/models")}
            />
          </Tooltip>
          <span className="mx-2 block h-6 border-l border-[#dfe5ec]" />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function AppShell() {
  const location = useLocation();
  const navigationItems = useNavigationItems();
  const isHome = location.pathname === "/";

  return (
    <div className="[--app-layout-height:calc(100dvh-155px)] [--app-page-padding-inline:32px] [--app-content-max-width:1376px] [--app-surface:rgba(255,255,255,0.72)] [--app-surface-strong:rgba(255,255,255,0.88)] [--app-surface-muted:rgba(248,250,255,0.78)] [--app-table-fixed-surface:#fbfcfe] [--app-table-fixed-header:#f6f8fc] [--app-table-fixed-hover:#f2f6fc] relative isolate flex min-h-dvh flex-col bg-[radial-gradient(circle_at_8%_0%,rgba(255,214,165,0.38),transparent_28rem),radial-gradient(circle_at_92%_10%,rgba(172,221,255,0.42),transparent_30rem),linear-gradient(135deg,#f8fbff_0%,#f8f7ff_48%,#fffaf7_100%)] max-[640px]:[--app-layout-height:calc(100dvh-135px)] max-[640px]:[--app-page-padding-inline:16px] min-[641px]:max-[1100px]:[--app-page-padding-inline:24px]">
      <AppTopbar />
      <main className="relative z-1 flex w-full flex-1 px-(--app-page-padding-inline) py-6 max-[640px]:py-4 [&_.ant-table]:bg-transparent [&_.ant-table-container]:bg-transparent [&_.ant-table-content]:bg-transparent [&_.ant-table-body]:bg-transparent [&_.ant-table-thead>tr>th]:bg-(--app-surface-muted) [&_.ant-table-tbody>tr>td]:bg-[rgba(255,255,255,0.46)] [&_.ant-table-thead>tr>th.ant-table-cell-fix]:bg-(--app-table-fixed-header) [&_.ant-table-tbody>tr>td.ant-table-cell-fix]:bg-(--app-table-fixed-surface) [&_.ant-table-tbody>tr:hover>td.ant-table-cell-fix]:bg-(--app-table-fixed-hover) [&_.ant-table-tbody>tr.ant-table-row-selected>td.ant-table-cell-fix]:bg-(--app-table-fixed-hover)">
        <div
          className={`mx-auto flex w-full max-w-(--app-content-max-width) min-w-0 flex-col ${
            isHome ? "" : "gap-4"
          }`}
        >
          {isHome ? null : <PageBreadcrumb items={navigationItems} />}
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function AppLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb]">
      <Spin size="large" />
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <NavigationProvider>
        <Suspense fallback={<AppLoading />}>
          <Routes>
            {publicRoutes.map(({ path, component: Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
            <Route
              element={
                <Protected>
                  <AppShell />
                </Protected>
              }
            >
              {staticRoutes.map(({ path, component: Component, superAdminOnly }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    superAdminOnly ? (
                      <ModelManager>
                        <Component />
                      </ModelManager>
                    ) : (
                      <Component />
                    )
                  }
                />
              ))}
              <Route path="/records/:modelCode/*" element={<DynamicPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </NavigationProvider>
    </BrowserRouter>
  );
}
