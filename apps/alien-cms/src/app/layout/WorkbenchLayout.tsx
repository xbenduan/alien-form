import { Suspense } from "react";
import type { ModelSummary } from "@alien-form/cms";
import { Alert, Spin } from "antd";
import { Outlet, useLocation, useOutletContext } from "react-router-dom";
import { useModelSummaries } from "../../hooks/use-schema-store";
import { WorkbenchSidebar } from "./components/WorkbenchSidebar";
import { resolveActiveKey } from "../router/routes";

export interface WorkbenchOutletContext {
  modelSummaries: ModelSummary[];
}

export function useWorkbenchLayout() {
  return useOutletContext<WorkbenchOutletContext>();
}

function ContentFallback() {
  return (
    <div className="model-page-loading">
      <Spin size="large" />
    </div>
  );
}

export default function WorkbenchLayout() {
  const location = useLocation();
  const modelSummariesQuery = useModelSummaries();
  const modelSummaries: ModelSummary[] = modelSummariesQuery.data ?? [];

  const activeSidebarKey = resolveActiveKey(location.pathname);

  return (
    <div className="model-page-shell">
      <div className="model-workbench-layout">
        <aside className="model-workbench-sidebar">
          <WorkbenchSidebar modelSummaries={modelSummaries} activeKey={activeSidebarKey} />
        </aside>

        <section className="model-workbench-main">
          <div className="model-workbench-main-panel">
            <div className="model-workbench-content">
              {modelSummariesQuery.isError ? (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginBottom: 16 }}
                  title="模型列表加载失败"
                  description={modelSummariesQuery.error.message}
                />
              ) : null}
              {modelSummariesQuery.isLoading && modelSummaries.length === 0 ? (
                <ContentFallback />
              ) : (
                <Suspense fallback={<ContentFallback />}>
                  <Outlet
                    context={
                      {
                        modelSummaries,
                      } satisfies WorkbenchOutletContext
                    }
                  />
                </Suspense>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
