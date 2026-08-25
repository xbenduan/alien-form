import { Children, type ReactNode } from "react";
import { Col, Row } from "antd";

interface GridOptions {
  gridSpan?: unknown;
  columns?: unknown;
  gutter?: unknown;
}

/** 栅格排布子字段：GridLayout / ObjectField / ArrayCards 共用（register/ 依赖组件）。 */
export function renderGridChildren(children: ReactNode, props: GridOptions) {
  const gridSpan =
    typeof props.gridSpan === "number"
      ? Math.min(24, Math.max(1, Math.floor(props.gridSpan)))
      : undefined;
  const columns = typeof props.columns === "number" ? props.columns : 2;
  const gutter = typeof props.gutter === "number" ? props.gutter : 16;
  const span = gridSpan ?? Math.max(1, Math.floor(24 / columns));

  return (
    <Row gutter={gutter}>
      {Children.toArray(children).map((child, index) => (
        <Col key={index} xs={24} md={12} lg={span}>
          {child}
        </Col>
      ))}
    </Row>
  );
}
