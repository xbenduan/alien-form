import { createForm } from "@alien-form/core";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Flex, Skeleton, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormRenderer, useRuntime } from "@binding";
import type { BuilderSchema } from "@engine";
import { transport } from "@runtime/transport";
import { decodeModel, encodeModel, type ModelEditorValues } from "./model-codec";
import { defaultFields, modelEditSchema } from "./model-edit-schema";

export function ModelEditor({ modelCode }: { modelCode?: string }) {
  const runtime = useRuntime();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(Boolean(modelCode));
  const [error, setError] = useState<string>();
  const form = useMemo(
    () =>
      createForm({
        schema: modelEditSchema,
        initialValues: {
          fieldsJson: JSON.stringify(defaultFields, null, 2),
        },
        scope: runtime.createScope(undefined, {}),
      }),
    [runtime],
  );

  useEffect(() => {
    if (!modelCode) return;
    const codeField = form.field("modelCode");
    codeField?.setDisabled(true);
    void transport
      .send<BuilderSchema>(`/api/schemas/${modelCode}`)
      .then((model) => form.setValues(decodeModel(model)))
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setLoading(false));
  }, [form, modelCode]);

  const save = async () => {
    setError(undefined);
    try {
      const values = await form.submit<ModelEditorValues>();
      const model = encodeModel(values);
      await transport.send<BuilderSchema>(
        modelCode ? `/api/schemas/${modelCode}` : "/api/schemas",
        {
          method: modelCode ? "PUT" : "POST",
          body: JSON.stringify(model),
        },
      );
      message.success("模型已保存");
      navigate("/models");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return (
    <section>
      <Flex justify="space-between" align="center" style={{ marginBottom: 20 }}>
        <div>
          <Typography.Title level={3}>{modelCode ? "编辑模型" : "新建模型"}</Typography.Title>
          <Typography.Text type="secondary">
            字段定义将写入 definitions['form-schema']
          </Typography.Text>
        </div>
        <Flex gap={8}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/models")}>
            返回
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => void save()}>
            保存
          </Button>
        </Flex>
      </Flex>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
      <Card>{loading ? <Skeleton active /> : <FormRenderer form={form} />}</Card>
    </section>
  );
}
