import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import WorkbenchLayout from "../layout/WorkbenchLayout";
import { buildRecordPath } from "./paths";
import { useModelSummaries } from "../../hooks/use-schema-store";
import ModelManagementPage from "../../domains/model/pages/ModelManagementPage";
import type { RecordRouteState } from "../../domains/record/types/record";
import ModelPage from "../../domains/model/pages/ModelPage";
import RecordActionPage from "../../domains/record/pages/RecordActionPage";
import RecordPage from "../../domains/record/pages/RecordPage";
import SystemSettingsPage from "../../domains/system/pages/SystemSettingsPage";
import LogPage from "../../domains/system/pages/LogPage";

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

function RoutedRecordPage({
  routeAction,
  pageType,
}: {
  routeAction: RecordRouteState;
  pageType: "list" | "action";
}) {
  const navigate = useNavigate();
  const params = useParams();
  const modelName = params.modelName ?? "";
  const resolvedRouteAction = resolveRouteAction(routeAction, params.recordId);

  if (pageType === "action") {
    return (
      <RecordActionPage
        modelName={modelName}
        routeAction={resolvedRouteAction}
        onRouteActionChange={(nextAction) => {
          navigate(buildRecordPath(modelName, nextAction));
        }}
      />
    );
  }

  return (
    <RecordPage
      modelName={modelName}
      routeAction={resolvedRouteAction}
      onRouteActionChange={(nextAction) => {
        navigate(buildRecordPath(modelName, nextAction));
      }}
    />
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorkbenchLayout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="models" element={<ModelManagementPage />} />
          <Route path="system/settings" element={<SystemSettingsPage />} />
          <Route path="system/logs" element={<LogPage />} />
          <Route path="models/new" element={<ModelPage />} />
          <Route path="models/:modelName/edit" element={<ModelPage />} />
          <Route
            path="records/:modelName"
            element={<RoutedRecordPage routeAction={{ mode: "closed" }} pageType="list" />}
          />
          <Route
            path="records/:modelName/add"
            element={<RoutedRecordPage routeAction={{ mode: "add" }} pageType="action" />}
          />
          <Route
            path="records/:modelName/edit/:recordId"
            element={<RoutedRecordPage routeAction={{ mode: "edit" }} pageType="action" />}
          />
          <Route
            path="records/:modelName/detail/:recordId"
            element={<RoutedRecordPage routeAction={{ mode: "detail" }} pageType="action" />}
          />
          <Route path="*" element={<HomeRedirect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
