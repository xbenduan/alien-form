import type { ModelSummary } from '@alien-form/cms';
import { Alert, Spin } from 'antd';
import { Outlet, useLocation } from 'react-router-dom';
import { useRecordModelSummaries } from '../../domains/record/hooks/use-record-model-summaries';
import { RecordWorkbenchHeader } from '../../domains/record/navigation/RecordWorkbenchHeader';

export interface WorkbenchOutletContext {
  modelSummaries: ModelSummary[];
}

export default function WorkbenchLayout() {
  const location = useLocation();
  const modelSummariesQuery = useRecordModelSummaries();
  const modelSummaries: ModelSummary[] = modelSummariesQuery.data ?? [];
  const pathname = location.pathname;
  const activeModel =
    pathname.startsWith('/records/')
      ? decodeURIComponent(pathname.split('/')[2] ?? '')
      : '';
  const activeGlobalKey =
    pathname === '/models' || pathname.startsWith('/models/')
      ? 'models'
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
          <RecordWorkbenchHeader
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
