import type React from "react";
import { defineAdapter } from "@alien-form/cms";
import { Card, Typography } from "antd";

function SectionCard({
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

export default defineAdapter(SectionCard, {
  key: "SectionCard",
  label: "SectionCard",
  description: "分组卡片容器组件。",
  kind: "component",
  scenes: ["recordForm", "recordDetail", "recordFilter"],
  meta: { fieldType: "object" },
});
