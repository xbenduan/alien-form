import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { BrowserRouterProps } from "react-router-dom";
import { buildRecordPath } from "./paths";
import WorkbenchLayout from "../layout/WorkbenchLayout";
import { staticRoutes, recordRoutes } from "./routes";
import type { RecordRouteState } from "../../domains/record/types/record";

export const routerFutureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} satisfies NonNullable<BrowserRouterProps["future"]>;

function resolveRouteAction(routeAction: RecordRouteState, recordId?: string): RecordRouteState {
  if (routeAction.mode === "add") {
    return routeAction;
  }

  return {
    ...routeAction,
    recordId,
  };
}

/**
 * Wrapper for record routes that injects modelName and navigation props.
 */
function RoutedRecordPage({
  routeAction,
  Component,
}: {
  routeAction: RecordRouteState;
  Component: React.LazyExoticComponent<React.ComponentType<any>>;
}) {
  const navigate = useNavigate();
  const params = useParams();
  const modelName = params.modelName ?? "";
  const resolvedRouteAction = resolveRouteAction(routeAction, params.recordId);

  return (
    <Component
      modelName={modelName}
      routeAction={resolvedRouteAction}
      onRouteActionChange={(nextAction: RecordRouteState) => {
        navigate(buildRecordPath(modelName, nextAction));
      }}
    />
  );
}

export function AppRouter() {
  return (
    <BrowserRouter future={routerFutureConfig}>
      <Routes>
        <Route path="/" element={<WorkbenchLayout />}>
          <Route index element={<Navigate replace to="/models" />} />

          {/* Static routes auto-generated from route config */}
          {staticRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<route.component />}
            />
          ))}

          {/* Record routes — need special wrapper for navigation props */}
          {recordRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <RoutedRecordPage
                  routeAction={route.props?.routeAction ?? { mode: "closed" }}
                  Component={route.component}
                />
              }
            />
          ))}

          <Route path="*" element={<Navigate replace to="/models" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
