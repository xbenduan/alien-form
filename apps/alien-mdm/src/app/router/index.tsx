import { Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "../layout";
import { useAuth } from "../../domains/auth/components/auth-provider";
import { loginPath } from "./paths";
import { publicRoutes, routes } from "./routes";

function ProtectedWorkbench() {
  const auth = useAuth();
  const location = useLocation();
  if (!auth.isAuthenticated) {
    return <Navigate replace to={loginPath()} state={{ from: location }} />;
  }
  return <Layout />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {publicRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <Suspense fallback={null}>
                <route.component {...(route.props ?? {})} />
              </Suspense>
            }
          />
        ))}
        <Route element={<ProtectedWorkbench />}>
          {routes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<route.component {...(route.props ?? {})} />}
            />
          ))}
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
