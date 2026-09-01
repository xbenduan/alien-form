import { Alert, Result, Skeleton, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { FormRenderer, PageProvider, useRuntime } from "@binding";
import type { PageRuntime } from "@engine";

export function DynamicPage() {
  const runtime = useRuntime();
  const location = useLocation();
  const { modelCode } = useParams();
  const [page, setPage] = useState<PageRuntime>();
  const [error, setError] = useState<string>();
  const segment = useMemo(() => {
    if (!modelCode) return "";
    return location.pathname
      .replace(new RegExp(`^/records/${modelCode}/?`), "")
      .replace(/^\/+|\/+$/g, "");
  }, [location.pathname, modelCode]);
  const query = useMemo(
    () => Object.fromEntries(new URLSearchParams(location.search)),
    [location.search],
  );

  useEffect(() => {
    if (!modelCode) return;
    let active = true;
    setPage(undefined);
    setError(undefined);
    void runtime
      .createPage(modelCode, segment, query)
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
  }, [modelCode, query, runtime, segment]);

  if (!modelCode) return <Result status="404" title="模型编码缺失" />;
  if (error) return <Alert type="error" message="动态页面加载失败" description={error} showIcon />;
  if (!page) return <Skeleton active />;
  return (
    <PageProvider page={page}>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        {page.page.title}
      </Typography.Title>
      <FormRenderer form={page.form} nodes={page.page.nodes} domain={page.domain} />
    </PageProvider>
  );
}
