import { Suspense } from "react";
import { Spin } from "antd";
import { Outlet } from "react-router-dom";

function ContentFallback() {
  return (
    <div className="model-page-loading">
      <Spin size="large" />
    </div>
  );
}

export default function WorkbenchLayout() {
  return (
    <div className="model-page-shell">
      <div className="model-workbench-main model-workbench-main-flat">
        <div className="model-workbench-content">
          <Suspense fallback={<ContentFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
