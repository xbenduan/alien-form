import type { ModelSummary } from '@alien-form/cms';
import { DatabaseOutlined } from '@ant-design/icons';
import { Card, Menu, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { buildModelListPath, buildRecordPath } from '../../../app/router/paths';

interface RecordWorkbenchHeaderProps {
  modelSummaries: ModelSummary[];
  activeModel: string;
}

export function RecordWorkbenchHeader({
  modelSummaries,
  activeModel,
}: RecordWorkbenchHeaderProps) {
  const navigate = useNavigate();

  return (
    <Card className="model-side-panel" styles={{ body: { padding: 20 } }}>
      <div className="model-side-panel-top">
        <div className="model-side-panel-title">内容模型工作台</div>
        <Typography.Paragraph
          className="model-side-panel-description"
          type="secondary"
          ellipsis={{ rows: 2, tooltip: '基于 alien-form 的 schema-driven 单页 CMS 验证应用。' }}
        >
          基于 alien-form 的 schema-driven 单页 CMS 验证应用。
        </Typography.Paragraph>
      </div>

      <div className="model-side-panel-section-title">全局功能</div>
      <div className="model-side-panel-menu-block">
        <Menu
          mode="inline"
          selectedKeys={[]}
          items={[
            {
              key: 'models',
              icon: <DatabaseOutlined />,
              label: '模型管理',
            },
          ]}
          onClick={({ key }) => {
            if (key === 'models') {
              navigate(buildModelListPath());
            }
          }}
        />
      </div>

      <div className="model-side-panel-section-title model-side-panel-section-title-spaced">模型列表</div>
      <div className="model-side-panel-menu-block">
        <Menu
          mode="inline"
          selectedKeys={activeModel ? [activeModel] : []}
          items={modelSummaries.map((item) => ({
            key: item.name,
            label: (
              <Tooltip
                placement="right"
                title={
                  <div className="model-menu-item-tooltip">
                    <div>{item.title}</div>
                    <div>{item.name}</div>
                    <div>{item.source === 'runtime' ? '运行时模型' : '静态模型'}</div>
                  </div>
                }
              >
                <div className="model-menu-item">
                  <span className="model-menu-item-name">{item.title}</span>
                </div>
              </Tooltip>
            ),
          }))}
          onClick={({ key }) => navigate(buildRecordPath(String(key)))}
        />
      </div>
    </Card>
  );
}
