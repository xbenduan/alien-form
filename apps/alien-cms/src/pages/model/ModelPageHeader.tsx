import { Card, Segmented, Space, Tag, Typography } from 'antd';
import type { ModelSummary } from '../../types/model';

interface ModelPageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  currentPath: string;
  modelSummaries: ModelSummary[];
  activeModel: string;
  onNavigateModel: (modelName: string) => void;
}

export function ModelPageHeader({
  title,
  subtitle,
  description,
  currentPath,
  modelSummaries,
  activeModel,
  onNavigateModel,
}: ModelPageHeaderProps) {
  return (
    <Card className="model-page-header">
      <div className="header-top-row">
        <Space size={12} wrap>
          <Tag color="blue">Alien CMS P1</Tag>
          {subtitle ? <Tag>{subtitle}</Tag> : null}
          <Tag color="gold">IndexedDB / Dexie</Tag>
        </Space>
        <div className="model-switcher-block">
          <Typography.Text type="secondary">模型入口</Typography.Text>
          <Segmented
            value={activeModel}
            options={modelSummaries.map((item) => ({
              label: item.name,
              value: item.name,
            }))}
            onChange={(value) => onNavigateModel(String(value))}
          />
        </div>
      </div>
      <Typography.Title level={2} style={{ marginBottom: 8, marginTop: 18 }}>
        {title}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8, maxWidth: 760 }}>
        {description}
      </Typography.Paragraph>
      <Typography.Text className="current-model-path">当前 URL: {currentPath}</Typography.Text>
    </Card>
  );
}
