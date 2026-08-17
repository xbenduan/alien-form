import type { CmsModelSchema } from "../types";
import { SchemaForm } from "@alien-form/shared";
import { Alert, Card } from "antd";
import { map as recordSchemaHandlers } from "../../../components/handlers";

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
        <SchemaForm
          mode="add"
          schema={schema}
          handlers={recordSchemaHandlers}
          className="schema-form-layout schema-form-layout-page"
        />
      ) : (
        <Alert type="info" showIcon message="暂无预览" description="请先补充模型信息和至少一个字段。" />
      )}
    </Card>
  );
}
