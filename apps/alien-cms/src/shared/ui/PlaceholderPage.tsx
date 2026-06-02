import { Alert, Card, Typography } from "antd";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <>
      <div className="model-breadcrumb-bar">
        <div className="model-breadcrumb-content">
          <Typography.Title level={4} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
        </div>
      </div>

      <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
        {description}
      </Card>
    </>
  );
}
