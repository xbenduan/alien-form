import { useMemo, useState } from "react";
import { Alert, Empty, Tabs } from "antd";
import { PageRoot } from "@alien-form/engine/react";
import { buildPreviewPage, type ModelSchema } from "../builder";
import { getAppRuntime } from "../../../runtime/create-runtime";
import { SchemaJsonEditor } from "./schema-json-editor";

interface SchemaPreviewProps {
  schema?: ModelSchema;
  error?: string;
}

/** 实时表单预览与可编辑模型源码共用一个面板。 */
export function SchemaPreview({ schema, error }: SchemaPreviewProps) {
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
    <Tabs
      activeKey={tab}
      onChange={setTab}
      items={[
        {
          key: "preview",
          label: "预览",
          children: pageSchema ? (
            <PageRoot key={pageSchema.id} schema={pageSchema} />
          ) : (
            <Empty description="正在生成预览" />
          ),
        },
        {
          key: "source",
          label: "源码",
          children: <SchemaJsonEditor />,
        },
      ]}
    />
  );
}
