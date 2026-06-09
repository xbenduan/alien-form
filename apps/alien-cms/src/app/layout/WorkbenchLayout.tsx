import { Suspense, type ReactNode } from "react";
import type { ModelSummary } from "@alien-form/cms";
import { Alert, Breadcrumb, Spin } from "antd";
import type { BreadcrumbProps } from "antd";
import { Outlet, useLocation, useOutletContext } from "react-router-dom";
import { useCallback, useState } from "react";
import { useModelSummaries } from "../../hooks/use-schema-store";
import { WorkbenchSidebar } from "./components/WorkbenchSidebar";
import { resolveActiveKey } from "../router/routes";

export interface WorkbenchBreadcrumb {
  items: BreadcrumbProps["items"];
  extra?: ReactNode;
}

export interface WorkbenchOutletContext {
  modelSummaries: ModelSummary[];
  setBreadcrumb: (next: WorkbenchBreadcrumb | null) => void;
}

export function useWorkbenchLayout() {
  return useOutletContext<WorkbenchOutletContext>();
}

function getBreadcrumbSignature(breadcrumb: WorkbenchBreadcrumb | null) {
  if (!breadcrumb) {
    return "empty";
  }

  const itemTitles = (breadcrumb.items ?? []).map((item, index) => {
    const title = "title" in item ? item.title : undefined;
    return typeof title === "string" ? title : `item-${index}`;
  });
  return `${itemTitles.join(" > ")}|extra:${breadcrumb.extra ? "1" : "0"}`;
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
  const [breadcrumb, setBreadcrumb] = useState<WorkbenchBreadcrumb | null>(null);
  const updateBreadcrumb = useCallback((next: WorkbenchBreadcrumb | null) => {
    setBreadcrumb((current) => {
      if (getBreadcrumbSignature(current) === getBreadcrumbSignature(next)) {
        return current;
      }
      return next;
    });
  }, []);

  const activeSidebarKey = resolveActiveKey(location.pathname);

  return (
    <div className="model-page-shell">
      <div className="model-workbench-layout">
        <aside className="model-workbench-sidebar">
          <WorkbenchSidebar modelSummaries={modelSummaries} activeKey={activeSidebarKey} />
        </aside>

        <section className="model-workbench-main">
          <div className="model-workbench-main-panel">
            <header className="model-breadcrumb-bar">
              <div className="model-breadcrumb-content">
                {breadcrumb?.items?.length ? <Breadcrumb items={breadcrumb.items} /> : null}
                {breadcrumb?.extra ?? null}
              </div>
            </header>

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
                        setBreadcrumb: updateBreadcrumb,
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
