import { Skeleton, Spin } from "antd";
import { Suspense, type ReactNode } from "react";
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

function AppShell() {
  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        <Suspense
          fallback={
            <div className={styles.loading}>
              <Spin size="large" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Skeleton active />}>
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
            {staticRoutes.map(({ path, component: Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
            <Route path="/records/:modelCode/*" element={<DynamicPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
