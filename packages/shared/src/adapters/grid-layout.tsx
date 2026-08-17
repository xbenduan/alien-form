import React from "react";
import { defineAdapter } from "../adapter";
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
    <div className="schema-grid-layout">
      {title ? (
        <Typography.Title level={5} className="schema-grid-layout-title">
          {title}
        </Typography.Title>
      ) : null}
      <Row gutter={gutter} className="schema-grid-layout-row">
        {React.Children.toArray(children).map((child, index) => (
          <Col key={index} xs={24} md={12} lg={span}>
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
  scenes: { form: {}, detail: {} },
  meta: { fieldType: "object" },
});
