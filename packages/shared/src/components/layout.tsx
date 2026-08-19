import type { ReactNode } from "react";
import { Children } from "react";
import { Col, Flex, Row, Typography } from "antd";
import type { FieldComponentProps } from "../types";

interface LayoutProps {
  title?: string;
  description?: string;
  children?: ReactNode;
}

/** 分组卡片容器（默认布局组件）。 */
export function Card({ title, description, children }: LayoutProps) {
  return (
    <fieldset className="af-card">
      {title ? <legend className="af-card-title">{title}</legend> : null}
      {description ? <div className="af-card-desc">{description}</div> : null}
      <div className="af-card-body">{children}</div>
    </fieldset>
  );
}

/** 栅格布局容器。 */
export function GridLayout(props: FieldComponentProps) {
  const gridSpan =
    typeof props.gridSpan === "number"
      ? Math.min(24, Math.max(1, Math.floor(props.gridSpan)))
      : undefined;
  const columns = typeof props.columns === "number" ? props.columns : 2;
  const gutter = typeof props.gutter === "number" ? props.gutter : 16;
  const span = gridSpan ?? Math.max(1, Math.floor(24 / columns));
  return (
    <div className="af-grid-layout">
      {props.title ? (
        <Typography.Title level={5} className="af-grid-layout-title">
          {props.title}
        </Typography.Title>
      ) : null}
      <Row gutter={gutter}>
        {Children.toArray(props.children).map((child, index) => (
          <Col key={index} xs={24} md={12} lg={span}>
            {child}
          </Col>
        ))}
      </Row>
    </div>
  );
}

/** 弹性布局容器。 */
export function FlexLayout(props: FieldComponentProps) {
  const vertical = props.vertical !== false;
  const gap = typeof props.gap === "number" ? props.gap : 16;
  return (
    <div className="af-flex-layout">
      {props.title ? (
        <Typography.Title level={5} className="af-flex-layout-title">
          {props.title}
        </Typography.Title>
      ) : null}
      <Flex vertical={vertical} gap={gap}>
        {props.children}
      </Flex>
    </div>
  );
}
