import { AppstoreAddOutlined, UnorderedListOutlined } from "@ant-design/icons";
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
import styles from "./index.module.css";

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
  const canManage = canManageModels();

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarPrimary}>
        <Link className={styles.brand} to="/" aria-label="返回首页">
          <span className={styles.brandMark}>
            <img src="/favicon.svg" alt="" aria-hidden="true" />
          </span>
          <span>
            <Typography.Text className={styles.kicker}>CONTENT OPERATIONS</Typography.Text>
            <Typography.Title level={3} className={styles.brandTitle}>
              ALIEN MDM
            </Typography.Title>
          </span>
        </Link>
        <div className={styles.topbarActions}>
          {canManage ? (
            <Tooltip title="新增模型">
              <Button
                type="text"
                shape="circle"
                icon={<AppstoreAddOutlined />}
                aria-label="新增模型"
                onClick={() => navigate("/models/add")}
              />
            </Tooltip>
          ) : null}
          <Tooltip title="模型管理">
            <Button
              type="text"
              shape="circle"
              icon={<UnorderedListOutlined />}
              aria-label="模型管理"
              onClick={() => navigate("/models")}
            />
          </Tooltip>
          <span className={styles.actionDivider} />
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
    <div className={styles.shell}>
      <AppTopbar />
      <main className={styles.page}>
        <div className={`${styles.content}${isHome ? "" : ` ${styles.withBreadcrumb}`}`}>
          {isHome ? null : <PageBreadcrumb items={navigationItems} />}
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function AppLoading() {
  return (
    <div className={styles.loading}>
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
