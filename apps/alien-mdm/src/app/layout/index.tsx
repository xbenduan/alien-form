import { Suspense } from "react";
import { Spin } from "antd";
import { Outlet } from "react-router-dom";
import styles from "./index.module.css";

function ContentFallback() {
  return (
    <div className={`${styles.index} ${styles.loading}`}>
      <Spin size="large" />
    </div>
  );
}

/** 工作台外壳：PC 工作站风格的扁平布局，内容区承载各路由页面。 */
export default function Index() {
  return (
    <div className={`${styles.index} ${styles.shell}`}>
      <div className={styles.content}>
        <Suspense fallback={<ContentFallback />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
