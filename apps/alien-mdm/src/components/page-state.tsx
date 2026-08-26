import type { ReactNode } from "react";
import { Alert, Card, Spin } from "antd";
import styles from "./index.module.css";

/** 页面级加载态。 */
export function PageLoading() {
  return (
    <Card styles={{ body: { padding: 24 } }}>
      <div className={`${styles.pageState} ${styles.center}`}>
        <Spin size="large" />
      </div>
    </Card>
  );
}

/** 页面级错误态。 */
export function PageError({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <Card styles={{ body: { padding: 24 } }}>
      <Alert type="error" showIcon message={title} description={description} />
    </Card>
  );
}
