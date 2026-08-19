import { Children } from "react";
import { Col, Row } from "antd";
import type { FieldComponentProps } from "../types";

/** 唯一的分组布局容器：栅格卡片。 */
export function GridLayout(props: FieldComponentProps) {
  const gridSpan =
    typeof props.gridSpan === "number"
      ? Math.min(24, Math.max(1, Math.floor(props.gridSpan)))
      : undefined;
  const columns = typeof props.columns === "number" ? props.columns : 2;
  const gutter = typeof props.gutter === "number" ? props.gutter : 16;
  const span = gridSpan ?? Math.max(1, Math.floor(24 / columns));
  return (
    <fieldset className="af-grid-layout af-layout-card">
      {props.title ? <legend className="af-card-title">{props.title}</legend> : null}
      {props.description ? <div className="af-card-desc">{props.description}</div> : null}
      <Row gutter={gutter}>
        {Children.toArray(props.children).map((child, index) => (
          <Col key={index} xs={24} md={12} lg={span}>
            {child}
          </Col>
        ))}
      </Row>
    </fieldset>
  );
}
