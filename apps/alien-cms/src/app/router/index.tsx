import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import WorkbenchLayout from "../layout/WorkbenchLayout";
import { buildRecordPath } from "./paths";
import { useModelSummaries } from "../../hooks/use-schema-store";
import ModelManagementPage from "../../domains/model/pages/ModelManagementPage";
import type { RecordRouteState } from "../../domains/record/types/record";
import ModelPage from "../../domains/model/pages/ModelPage";
import RecordPage from "../../domains/record/pages/RecordPage";

function HomeRedirect() {
  const modelSummariesQuery = useModelSummaries();
  if (modelSummariesQuery.isLoading) {
    return null;
  }

  const defaultModelName = modelSummariesQuery.data?.[0]?.name ?? "nail-booking";
  return <Navigate replace to={buildRecordPath(defaultModelName)} />;
}

function RoutedRecordPage({ routeAction }: { routeAction: RecordRouteState }) {
  const navigate = useNavigate();
  const params = useParams();
  const modelName = params.modelName ?? "";

  return (
    <RecordPage
      modelName={modelName}
      routeAction={
        routeAction.mode === "add"
          ? routeAction
          : {
              ...routeAction,
              recordId: params.recordId,
            }
      }
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
          <Route path="models/new" element={<ModelPage />} />
          <Route path="models/:modelName/edit" element={<ModelPage />} />
          <Route
            path="records/:modelName"
            element={<RoutedRecordPage routeAction={{ mode: "closed" }} />}
          />
          <Route
            path="records/:modelName/add"
            element={<RoutedRecordPage routeAction={{ mode: "add" }} />}
          />
          <Route
            path="records/:modelName/edit/:recordId"
            element={<RoutedRecordPage routeAction={{ mode: "edit" }} />}
          />
          <Route
            path="records/:modelName/detail/:recordId"
            element={<RoutedRecordPage routeAction={{ mode: "detail" }} />}
          />
          <Route path="*" element={<HomeRedirect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
