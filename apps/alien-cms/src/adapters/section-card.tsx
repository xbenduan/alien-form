import type React from 'react';
import { Card, Typography } from 'antd';

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
    <Card style={{ marginBottom: 24 }}>
      {title ? (
        <div style={{ marginBottom: 16 }}>
          <Typography.Title level={5} style={{ marginBottom: 4 }}>
            {title}
          </Typography.Title>
          {description ? (
            <Typography.Text type="secondary">{description}</Typography.Text>
          ) : null}
        </div>
      ) : null}
      {children}
    </Card>
  );
}
