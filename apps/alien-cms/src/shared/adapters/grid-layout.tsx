import React from "react";
import { defineAdapter } from "@alien-form/cms";
import { Col, Row, Typography } from "antd";

function GridLayout({
  title,
  columns = 2,
  gutter = 16,
  children,
}: {
  title?: string;
  description?: string;
  columns?: number;
  gutter?: number | [number, number];
  children?: React.ReactNode;
}) {
  const span = Math.max(1, Math.floor(24 / columns));
  return (
    <div style={{ marginBottom: 24 }}>
      {title ? (
        <Typography.Title level={5} style={{ marginBottom: 12 }}>
          {title}
        </Typography.Title>
      ) : null}
      <Row gutter={gutter}>
        {React.Children.toArray(children).map((child, index) => (
          <Col key={index} span={span}>
            {child}
          </Col>
        ))}
      </Row>
    </div>
  );
}

export default defineAdapter(GridLayout, {
  key: "GridLayout",
  label: "栅格布局",
  description: "基于栅格的容器布局组件。",
  kind: "component",
  scenes: { recordForm: { mode: "edit" }, recordDetail: { mode: "readonly" } },
  meta: { fieldType: "object" },
});
