import { Suspense } from "react";
import { Spin } from "antd";
import { Outlet } from "react-router-dom";
import styles from "./WorkbenchLayout.module.css";

function ContentFallback() {
  return (
    <div className={styles.loading}>
      <Spin size="large" />
    </div>
  );
}

/** 工作台外壳：PC 工作站风格的扁平布局，内容区承载各路由页面。 */
export default function WorkbenchLayout() {
  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        <Suspense fallback={<ContentFallback />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
