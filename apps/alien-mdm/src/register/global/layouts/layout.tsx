import { Layout as AntLayout } from "antd";
import type { ReactNode } from "react";
import styles from "./index.module.css";

export function Layout({
  slots,
  children,
}: {
  slots: Record<string, ReactNode>;
  children?: ReactNode;
}) {
  const main = (
    <AntLayout.Content
      className={styles.layoutMain}
      style={{
        background: "transparent",
      }}
    >
      {slots.rightTop}
      {slots.rightBottom}
      {children}
    </AntLayout.Content>
  );

  if (!slots.left) {
    return <AntLayout className={styles.layoutStack}>{main}</AntLayout>;
  }
  return (
    <AntLayout hasSider className={styles.layout} style={{ background: "transparent" }}>
      <AntLayout.Sider
        className={styles.layoutLeft}
        width={280}
        theme="light"
        style={{ minWidth: 240, background: "transparent" }}
      >
        {slots.left}
      </AntLayout.Sider>
      {main}
    </AntLayout>
  );
}
