import type { CmsModelSchema } from '@alien-form/cms';
import { Alert, Card } from 'antd';
import { SchemaFormView } from '../model/SchemaRenderer';

interface ModelPreviewPanelProps {
  schema?: CmsModelSchema;
  error?: string;
  hideTitle?: boolean;
}

export function ModelPreviewPanel({ schema, error }: ModelPreviewPanelProps) {
  return (
    <Card className="model-query-card" styles={{ body: { padding: 20 } }}>
      {error ? (
        <Alert type="warning" showIcon message="预览生成失败" description={error} />
      ) : schema ? (
        <SchemaFormView
          schema={schema}
          submitText=""
          hideActions
          layout="page"
          onSubmit={async () => {}}
          onCancel={() => {}}
        />
      ) : (
        <Alert type="info" showIcon message="暂无预览" description="请先补充模型信息和至少一个字段。" />
      )}
    </Card>
  );
}
