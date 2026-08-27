import { useMemo, useState } from "react";
import { Alert, Empty, Segmented, Tabs } from "antd";
import { PageRoot } from "@alien-form/engine/react";
import { buildPreviewPage, type ModelSchema } from "../builder";
import { getAppRuntime } from "@runtime/create-runtime";
import { SchemaJsonEditor } from "./schema-json-editor";
import { FieldsetCard } from "@components";

interface SchemaPreviewProps {
  schema?: ModelSchema;
  error?: string;
  className?: string;
}

/** 实时表单预览与可编辑模型源码共用一个面板。 */
export function SchemaPreview({ schema, error, className }: SchemaPreviewProps) {
  const [tab, setTab] = useState("preview");
  const pageSchema = useMemo(
    () => (schema ? buildPreviewPage(getAppRuntime().registry, schema) : undefined),
    [schema],
  );

  if (error) {
    return <Alert type="error" showIcon message="Schema 生成失败" description={error} />;
  }
  if (!schema) {
    return <Empty description="暂无可预览的 Schema" />;
  }

  return (
    <FieldsetCard
      title={
        <Segmented
          onChange={setTab}
          options={[
            { value: "preview", label: "预览" },
            { value: "source", label: "源码" },
          ]}
        />
      }
      className={className}
    >
      {tab === "preview" ? (
        pageSchema ? (
          <PageRoot key={pageSchema.id} schema={pageSchema} />
        ) : (
          <Empty description="正在生成预览" />
        )
      ) : (
        <SchemaJsonEditor />
      )}
    </FieldsetCard>
  );
}
