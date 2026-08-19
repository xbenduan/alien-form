import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { BrowserRouterProps } from "react-router-dom";
import WorkbenchLayout from "../layout/WorkbenchLayout";
import { routes } from "./routes";

const futureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} satisfies NonNullable<BrowserRouterProps["future"]>;

export function AppRouter() {
  return (
    <BrowserRouter future={futureConfig}>
      <Routes>
        <Route element={<WorkbenchLayout />}>
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
