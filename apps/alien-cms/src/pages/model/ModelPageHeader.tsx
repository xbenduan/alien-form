import {
  DatabaseOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Card, Menu, Tag, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { buildBuilderNewPath, buildModelPath } from '../../app/model-path';
import type { ModelSummary } from '../../types/model';

interface ModelPageHeaderProps {
  modelSummaries: ModelSummary[];
  activeModel: string;
  activeGlobalKey?: 'new-model' | 'logs' | 'settings';
}

export function ModelPageHeader({
  modelSummaries,
  activeModel,
  activeGlobalKey,
}: ModelPageHeaderProps) {
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
          selectedKeys={activeGlobalKey ? [activeGlobalKey] : []}
          items={[
            {
              key: 'new-model',
              icon: <DatabaseOutlined />,
              label: '新增模型',
            },
            {
              key: 'logs',
              icon: <DatabaseOutlined />,
              label: (
                <span className="model-global-nav-item">
                  <span>日志</span>
                  <Tag bordered={false} color="processing">
                    开发中
                  </Tag>
                </span>
              ),
            },
            {
              key: 'settings',
              icon: <SettingOutlined />,
              label: (
                <span className="model-global-nav-item">
                  <span>设置</span>
                  <Tag bordered={false} color="processing">
                    开发中
                  </Tag>
                </span>
              ),
            },
          ]}
          onClick={({ key }) => {
            if (key === 'new-model') {
              navigate(buildBuilderNewPath());
              return;
            }

            navigate(`/${String(key)}`);
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
          onClick={({ key }) => navigate(buildModelPath(String(key)))}
        />
      </div>
    </Card>
  );
}
