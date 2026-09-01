import { createForm } from "@alien-form/core";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Drawer, Flex, Skeleton, message } from "antd";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { FormRenderer, useRuntime, type ComponentProps } from "@binding";
import { compileForm, type FieldSchema } from "@engine";
import { transport } from "@runtime/transport";

export function RecordPage({ title, children, slots }: ComponentProps & { title?: ReactNode }) {
  return (
    <Card title={title} extra={slots.actions}>
      {children}
    </Card>
  );
}

export function Overlay({
  open = true,
  title,
  width = 720,
  onClose,
  children,
}: ComponentProps & {
  open?: boolean;
  title?: ReactNode;
  width?: number;
  onClose?: () => void;
}) {
  return (
    <Drawer open={open} title={title} width={width} onClose={onClose}>
      {children}
    </Drawer>
  );
}

export function RecordForm({
  mode,
  modelCode,
  recordId,
  schema,
}: ComponentProps & {
  mode: "add" | "edit" | "detail";
  modelCode: string;
  recordId?: string;
  schema: FieldSchema;
}) {
  const runtime = useRuntime();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(mode !== "add");
  const [error, setError] = useState<string>();
  const compiled = useMemo(
    () => compileForm({ properties: schema.properties ?? {} }, { "form-schema": schema }),
    [schema],
  );
  const form = useMemo(
    () =>
      createForm({
        schema: compiled.schema,
        scope: runtime.createScope(
          modelCode,
          Object.fromEntries(new URLSearchParams(location.search)),
        ),
      }),
    [compiled.schema, modelCode, runtime],
  );

  useEffect(() => {
    if (mode === "detail") {
      for (const field of form.fields().values()) field.setDisabled(true);
    }
    if (mode === "add" || !recordId) {
      setLoading(false);
      return;
    }
    void transport
      .send<Record<string, unknown>>(`/api/records/${modelCode}/${recordId}`)
      .then((record) => form.setValues(record))
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setLoading(false));
  }, [form, mode, modelCode, recordId]);

  const save = async () => {
    setError(undefined);
    try {
      const values = await form.submit<Record<string, unknown>>();
      await transport.send(
        mode === "edit" ? `/api/records/${modelCode}/${recordId}` : `/api/records/${modelCode}`,
        {
          method: mode === "edit" ? "PUT" : "POST",
          body: JSON.stringify(values),
        },
      );
      message.success("记录已保存");
      navigate(`/records/${modelCode}/list`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return (
    <Card>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
      {loading ? (
        <Skeleton active />
      ) : (
        <>
          <FormRenderer form={form} nodes={compiled.nodes} domain={modelCode} />
          <Flex justify="end" gap={8}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
              返回
            </Button>
            {mode !== "detail" && (
              <Button type="primary" icon={<SaveOutlined />} onClick={() => void save()}>
                保存
              </Button>
            )}
          </Flex>
        </>
      )}
    </Card>
  );
}
