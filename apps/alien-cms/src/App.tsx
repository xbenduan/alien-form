import type { ModelSummary } from '@alien-form/cms';
import { Alert, Spin } from 'antd';
import { Outlet, useLocation } from 'react-router-dom';
import { useModelSummaries } from './hooks/use-model-summaries';
import { ModelPageHeader } from './pages/model/ModelPageHeader';

export interface WorkbenchOutletContext {
  modelSummaries: ModelSummary[];
}

export default function App() {
  const location = useLocation();
  const modelSummariesQuery = useModelSummaries();
  const modelSummaries: ModelSummary[] = modelSummariesQuery.data ?? [];
  const pathname = location.pathname;
  const builderEditMatch = pathname.match(/^\/builder\/edit\/(.+)/);
  const activeModel =
    pathname.startsWith('/m/')
      ? decodeURIComponent(pathname.split('/')[2] ?? '')
      : builderEditMatch
        ? decodeURIComponent(builderEditMatch[1])
        : '';
  const activeGlobalKey =
    pathname === '/builder/new'
      ? 'new-model'
      : pathname.startsWith('/logs')
        ? 'logs'
        : pathname.startsWith('/settings')
          ? 'settings'
          : undefined;

  if (modelSummariesQuery.isError) {
    return <Alert type="error" showIcon message="模型列表加载失败" description={modelSummariesQuery.error.message} />;
  }

  return (
    <div className="model-page-shell">
      <div className="model-workbench-layout">
        <aside className="model-workbench-sidebar">
          <ModelPageHeader
            modelSummaries={modelSummaries}
            activeModel={activeModel}
            activeGlobalKey={activeGlobalKey}
          />
        </aside>

        <section className="model-workbench-main">
          {modelSummariesQuery.isLoading && modelSummaries.length === 0 ? (
            <div className="model-page-loading">
              <Spin size="large" />
            </div>
          ) : (
            <Outlet context={{ modelSummaries } satisfies WorkbenchOutletContext} />
          )}
        </section>
      </div>
    </div>
  );
}
