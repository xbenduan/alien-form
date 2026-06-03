import type { ModelSummary } from '@alien-form/cms';
import { Alert, Spin } from 'antd';
import { Outlet, useLocation } from 'react-router-dom';
import { useModelSummaries } from '../../hooks/use-schema-store';
import { RecordWorkbenchHeader } from '../../domains/record/navigation/RecordWorkbenchHeader';

export interface WorkbenchOutletContext {
  modelSummaries: ModelSummary[];
}

export default function WorkbenchLayout() {
  const location = useLocation();
  const modelSummariesQuery = useModelSummaries();
  const modelSummaries: ModelSummary[] = modelSummariesQuery.data ?? [];
  const pathname = location.pathname;
  const activeModel =
    pathname.startsWith('/records/')
      ? decodeURIComponent(pathname.split('/')[2] ?? '')
      : '';

  if (modelSummariesQuery.isError) {
    return <Alert type="error" showIcon message="模型列表加载失败" description={modelSummariesQuery.error.message} />;
  }

  return (
    <div className="model-page-shell">
      <div className="model-workbench-layout">
        <aside className="model-workbench-sidebar">
          <RecordWorkbenchHeader
            modelSummaries={modelSummaries}
            activeModel={activeModel}
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
