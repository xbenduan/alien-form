import { Row, Col } from "antd";
import { RenderNode, type ComponentProps } from "@alien-form/engine/react";

export function TreeLayout({ node, children }: ComponentProps) {
  const tree = node.slots?.tree ?? [];
  const filter = node.slots?.filter ?? [];
  const table = node.slots?.table ?? [];

  return (
    <Row gutter={16}>
      <Col span={6}>
        {tree.map((n, i) => (
          <RenderNode key={i} node={n} />
        ))}
      </Col>
      <Col span={18}>
        {filter.map((n, i) => (
          <RenderNode key={i} node={n} />
        ))}
        {table.map((n, i) => (
          <RenderNode key={i} node={n} />
        ))}
        {children as React.ReactNode}
      </Col>
    </Row>
  );
}
