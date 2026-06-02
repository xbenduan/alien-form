import { ArrowLeftOutlined } from '@ant-design/icons';
import { Breadcrumb, Button, Card } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PlaceholderPage } from '../../../shared/ui/PlaceholderPage';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modelName = searchParams.get('model') ?? '';

  return (
    <>
      <div className="model-breadcrumb-bar">
        <div className="model-breadcrumb-content">
          <Breadcrumb
            items={[
              { title: '模型管理' },
              ...(modelName ? [{ title: modelName }] : []),
              { title: '设置' },
            ]}
          />
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
        </div>
      </div>

      <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
        <PlaceholderPage
          title={modelName ? `${modelName} 设置` : '全局设置'}
          description="设置模块正在开发中，后续会补充全局工作台配置、provider 接入与偏好管理。"
        />
      </Card>
    </>
  );
}
