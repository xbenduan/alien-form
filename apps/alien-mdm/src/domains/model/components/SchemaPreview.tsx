import { useMemo, useState } from "react";
import { Alert, Empty, Segmented, Typography } from "antd";
import { FormRenderer, useCreateForm, type IFormSchema } from "@alien-form/react";
import { useCompiledSchema } from "../../../compiler";
import type { ModelSchema } from "../types";
import { FieldsetCard } from "../../../components";
import { fieldComponents } from "../../../register/global/form/registry";
import { fieldDecorators } from "../../../components/field-registry";

interface SchemaPreviewProps {
  schema?: ModelSchema;
  error?: string;
}

function PreviewForm({ schema, formKey }: { schema: IFormSchema; formKey: string }) {
  const scope = useMemo(() => ({ mode: "add" }), []);
  const form = useCreateForm({ schema, scope }, [schema, formKey, scope]);
  return <FormRenderer form={form} components={fieldComponents} decorators={fieldDecorators} />;
}

/** schema 预览：表单效果预览 + JSON 源码切换。预览不拉真实外键（resolveData=false）。 */
export function SchemaPreview({ schema, error }: SchemaPreviewProps) {
  const [tab, setTab] = useState<"form" | "json">("form");
  const compiled = useCompiledSchema(schema, false);

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
        compiled.data ? (
          <PreviewForm schema={compiled.data.form} formKey={schema.meta.name} />
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
