import { Card, Menu, Space, Tag, Tooltip, Typography } from "antd";
import type { ModelSummary } from "../../types/model";

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
    <Card className="model-side-panel" styles={{ body: { padding: 20 } }}>
      <div className="model-side-panel-top">
        <div className="model-side-panel-title">{title}</div>
        <Typography.Paragraph
          className="model-side-panel-description"
          type="secondary"
          ellipsis={description ? { rows: 2, tooltip: description } : false}
        >
          {description || "—"}
        </Typography.Paragraph>
        <Typography.Text className="current-model-path">{currentPath}</Typography.Text>
      </div>

      <div className="model-side-panel-menu-block">
        <Menu
          mode="inline"
          selectedKeys={[activeModel]}
          items={modelSummaries.map((item) => ({
            key: item.name,
            label: (
              <Tooltip
                placement="right"
                title={
                  <div className="model-menu-item-tooltip">
                    <div>{item.title}</div>
                    <div>{item.name}</div>
                  </div>
                }
              >
                <div className="model-menu-item">
                  <span className="model-menu-item-name">{item.title}</span>
                </div>
              </Tooltip>
            ),
          }))}
          onClick={({ key }) => onNavigateModel(String(key))}
        />
      </div>
    </Card>
  );
}
