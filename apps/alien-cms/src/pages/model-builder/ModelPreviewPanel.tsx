import { Alert, Card, Typography } from 'antd';
import { SchemaFormView } from '../model/SchemaRenderer';
import type { CmsModelSchema } from '../../types/model';

interface ModelPreviewPanelProps {
  schema?: CmsModelSchema;
  error?: string;
}

export function ModelPreviewPanel({ schema, error }: ModelPreviewPanelProps) {
  return (
    <Card className="model-query-card" styles={{ body: { padding: 20 } }}>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        表单预览
      </Typography.Title>

      {error ? (
        <Alert type="warning" showIcon message="预览生成失败" description={error} />
      ) : schema ? (
        <SchemaFormView
          schema={schema}
          submitText="预览提交"
          layout="page"
          onCancel={() => undefined}
          onSubmit={async () => undefined}
        />
      ) : (
        <Alert type="info" showIcon message="暂无预览" description="请先补充模型信息和至少一个字段。" />
      )}
    </Card>
  );
}
