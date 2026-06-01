import { Alert } from 'antd';
import { getDefaultModelName, listModelSummaries } from './core/schema/load-schema';
import { useModelRoute } from './app/model-route';
import ModelPage from './pages/model/ModelPage';

export default function App() {
  const modelSummaries = listModelSummaries();
  const availableModelNames = modelSummaries.map((item) => item.name);
  const defaultModelName = getDefaultModelName();
  const { currentModel, currentPath, navigateToModel } = useModelRoute(
    availableModelNames,
    defaultModelName,
  );

  if (modelSummaries.length === 0) {
    return <Alert type="error" showIcon message="未找到可用模型 schema" />;
  }

  return (
    <ModelPage
      key={currentModel}
      modelName={currentModel}
      modelSummaries={modelSummaries}
      currentPath={currentPath}
      onNavigateModel={navigateToModel}
    />
  );
}
