import { Alert, Result, Skeleton } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { FormRenderer, PageProvider, useRuntime } from "@binding";
import type { PageRuntime } from "@alien-form/engine";
import { PageBreadcrumb } from "../../components";
import { recordListRoute } from "@utils/record-route";
import styles from "./dynamic-routes.module.css";

export function DynamicPage() {
  const runtime = useRuntime();
  const location = useLocation();
  const { modelCode } = useParams();
  const [page, setPage] = useState<PageRuntime>();
  const [error, setError] = useState<string>();
  const route = useMemo(() => {
    if (!modelCode) return { segment: "", recordId: undefined };
    const parts = location.pathname
      .replace(new RegExp(`^/records/${modelCode}/?`), "")
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean);
    return {
      segment: parts[0] ?? "list",
      recordId: parts[1],
    };
  }, [location.pathname, modelCode]);
  const query = useMemo(
    () => ({
      ...Object.fromEntries(new URLSearchParams(location.search)),
      ...(route.recordId ? { id: route.recordId } : {}),
    }),
    [location.search, route.recordId],
  );

  useEffect(() => {
    if (!modelCode) return;
    let active = true;
    setPage(undefined);
    setError(undefined);
    void runtime
      .createPage(modelCode, route.segment, query)
      .then((next) => {
        if (active) setPage(next);
        else next.destroy();
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      active = false;
    };
  }, [modelCode, query, route.segment, runtime]);

  if (!modelCode) return <Result status="404" title="模型编码缺失" />;
  if (error) return <Alert type="error" message="动态页面加载失败" description={error} showIcon />;
  if (!page) return <Skeleton active />;
  const isAction = page.page.router !== "list";
  return (
    <PageProvider page={page}>
      <div className={`${styles.recordRoute}${isAction ? ` ${styles.actionRoute}` : ""}`}>
        <PageBreadcrumb
          items={
            isAction
              ? [
                  {
                    title: `${page.model.meta.pluralLabel ?? page.model.meta.title}列表`,
                    to: recordListRoute(page.domain),
                  },
                  { title: page.page.title },
                ]
              : [{ title: page.page.title }]
          }
        />
        <FormRenderer form={page.form} nodes={page.page.nodes} domain={page.domain} />
      </div>
    </PageProvider>
  );
}
