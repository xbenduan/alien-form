import { Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Spin } from "antd";
import WorkbenchLayout from "../layout/WorkbenchLayout";
import { buildRecordPath } from "./paths";
import { useModelSummaries } from "../../hooks/use-schema-store";
import { staticRoutes, recordRoutes } from "./routes";
import type { RecordRouteState } from "../../domains/record/types/record";

function HomeRedirect() {
  const modelSummariesQuery = useModelSummaries();
  if (modelSummariesQuery.isLoading) {
    return null;
  }

  const defaultModelName = modelSummariesQuery.data?.[0]?.name ?? "nail-booking";
  return <Navigate replace to={buildRecordPath(defaultModelName)} />;
}

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
  pageType,
  Component,
}: {
  routeAction: RecordRouteState;
  pageType: "list" | "action";
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

function LazyFallback() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
      <Spin size="large" />
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route path="/" element={<WorkbenchLayout />}>
            <Route index element={<HomeRedirect />} />

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
                    pageType={route.props?.pageType ?? "list"}
                    Component={route.component}
                  />
                }
              />
            ))}

            <Route path="*" element={<HomeRedirect />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
