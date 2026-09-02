import { Spin } from "antd";
import { Suspense, type PropsWithChildren, type ReactNode } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../providers";
import { DynamicPage } from "./dynamic-routes";
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

function AppShell({ noPadding = false, children }: PropsWithChildren<{ noPadding?: boolean }>) {
  return (
    <div className={`${styles.shell}${noPadding ? ` ${styles.noPadding}` : ""}`}>
      <div className={styles.content}>{children ?? <Outlet />}</div>
    </div>
  );
}

function AppLoading() {
  return (
    <AppShell noPadding>
      <div className={styles.loading}>
        <Spin size="large" />
      </div>
    </AppShell>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<AppLoading />}>
        <Routes>
          {publicRoutes.map(({ path, component: Component }) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
          <Route
            element={
              <Protected>
                <AppShell noPadding />
              </Protected>
            }
          >
            {staticRoutes
              .filter(({ path }) => path === "/")
              .map(({ path, component: Component }) => (
                <Route key={path} path={path} element={<Component />} />
              ))}
          </Route>
          <Route
            element={
              <Protected>
                <AppShell />
              </Protected>
            }
          >
            {staticRoutes.map(({ path, component: Component }) =>
              path === "/" ? null : <Route key={path} path={path} element={<Component />} />,
            )}
            <Route path="/records/:modelCode/*" element={<DynamicPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
