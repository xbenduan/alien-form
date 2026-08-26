import { useMemo, useState } from "react";
import { Alert, Empty, Segmented, Typography } from "antd";
import { PageRoot } from "@alien-form/engine/react";
import { buildPreviewPage, type ModelSchema } from "../builder";
import { FieldsetCard } from "@components";

interface SchemaPreviewProps {
  schema?: ModelSchema;
  error?: string;
}

/** schema 预览：表单效果预览 + JSON 源码切换。 */
export function SchemaPreview({ schema, error }: SchemaPreviewProps) {
  const [tab, setTab] = useState<"form" | "json">("form");
  const pageSchema = useMemo(() => (schema ? buildPreviewPage(schema) : undefined), [schema]);

  if (error) {
    return <Alert type="error" showIcon message="Schema 生成失败" description={error} />;
  }
  if (!schema) {
    return <Empty description="暂无可预览的 schema" />;
  }

  return (
    <FieldsetCard
      title={
        <Segmented
          style={{ border: "1px solid #e4e9f0" }}
          value={tab}
          onChange={(value) => setTab(value as "form" | "json")}
          options={[
            { label: "表单预览", value: "form" },
            { label: "Schema JSON", value: "json" },
          ]}
        />
      }
    >
      {tab === "form" ? (
        pageSchema ? (
          <PageRoot key={pageSchema.id} schema={pageSchema} />
        ) : (
          <Empty description="正在生成预览…" />
        )
      ) : (
        <Typography.Paragraph>
          <pre>{JSON.stringify(schema, null, 2)}</pre>
        </Typography.Paragraph>
      )}
    </FieldsetCard>
  );
}
