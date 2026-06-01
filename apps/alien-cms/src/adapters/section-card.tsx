import type React from "react";
import { Card, Typography } from "antd";

export function SectionCard({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card
      style={{ marginBottom: 24 }}
      title={title}
      extra={description ? <Typography.Text type="secondary">{description}</Typography.Text> : null}
    >
      {children}
    </Card>
  );
}
