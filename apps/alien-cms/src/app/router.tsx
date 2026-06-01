import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import App from '../App';
import { buildModelPath } from './model-path';
import { getDefaultModelName } from '../core/schema/load-schema';
import { useModelSummaries } from '../hooks/use-model-summaries';
import type { ModelRouteState } from '../types/model';
import ModelBuilderPage from '../pages/model-builder/ModelBuilderPage';
import LogsPage from '../pages/logs/LogsPage';
import ModelPage from '../pages/model/ModelPage';
import SettingsPage from '../pages/settings/SettingsPage';

function HomeRedirect() {
  const modelSummariesQuery = useModelSummaries();
  if (modelSummariesQuery.isLoading) {
    return null;
  }

  const defaultModelName = modelSummariesQuery.data?.[0]?.name ?? getDefaultModelName();
  return <Navigate replace to={buildModelPath(defaultModelName)} />;
}

function RoutedModelPage({ routeAction }: { routeAction: ModelRouteState }) {
  const navigate = useNavigate();
  const params = useParams();
  const modelName = params.modelName ?? '';

  return (
    <ModelPage
      modelName={modelName}
      routeAction={
        routeAction.mode === 'add'
          ? routeAction
          : {
              ...routeAction,
              recordId: params.recordId,
            }
      }
      onRouteActionChange={(nextAction) => {
        navigate(buildModelPath(modelName, nextAction));
      }}
    />
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<HomeRedirect />} />
          <Route path="models/new" element={<ModelBuilderPage />} />
          <Route path="models/:modelName" element={<RoutedModelPage routeAction={{ mode: 'closed' }} />} />
          <Route path="models/:modelName/add" element={<RoutedModelPage routeAction={{ mode: 'add' }} />} />
          <Route
            path="models/:modelName/edit/:recordId"
            element={<RoutedModelPage routeAction={{ mode: 'edit' }} />}
          />
          <Route
            path="models/:modelName/detail/:recordId"
            element={<RoutedModelPage routeAction={{ mode: 'detail' }} />}
          />
          <Route path="logs" element={<LogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<HomeRedirect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
