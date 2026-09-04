import { useCreateForm } from "@alien-form/react";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { Alert, App, Button, Space, Spin } from "antd";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FormRenderer, useRuntime } from "@binding";
import { compileForm, type FieldSchema } from "@alien-form/engine";
import { recordListRoute } from "@utils/record-route";
import styles from "./index.module.css";

export type RecordActionMode = "add" | "edit" | "detail";

interface RecordFormProps {
  mode: RecordActionMode;
  modelCode: string;
  recordId?: string;
  schema: FieldSchema;
  ok?: ReactNode;
  submit?: (
    values: Record<string, unknown>,
    context: { mode: RecordActionMode; modelCode: string; recordId?: string },
  ) => unknown | Promise<unknown>;
  embedded?: boolean;
  onCancel?: () => void;
  onSaved?: () => void | Promise<void>;
}

export interface RecordFormHandle {
  submit(): Promise<void>;
}

interface RecordServices {
  records?: {
    get?: (request: {
      model: string;
      id: string;
    }) => Record<string, unknown> | Promise<Record<string, unknown>>;
  };
}

export const RecordForm = forwardRef<RecordFormHandle, RecordFormProps>(function RecordForm(
  { mode, modelCode, recordId, schema, ok, submit, embedded = false, onCancel, onSaved },
  ref,
) {
  const runtime = useRuntime();
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(mode !== "add");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const compiled = useMemo(
    () =>
      compileForm(
        { properties: schema.properties ?? {}, group: schema.group },
        { "form-schema": schema },
      ),
    [schema],
  );
  const form = useCreateForm(
    {
      schema: compiled.schema,
      scope: runtime.createScope(
        modelCode,
        Object.fromEntries(new URLSearchParams(location.search)),
        mode,
      ),
    },
    [compiled.schema, location.search, mode, modelCode, runtime],
  );

  useEffect(() => {
    if (mode === "add" || !recordId) {
      setLoading(false);
      return;
    }
    const services = form.scope.$service as RecordServices | undefined;
    const getRecord = services?.records?.get;
    if (!getRecord) {
      setError("$service.records.get 未注册");
      setLoading(false);
      return;
    }
    void Promise.resolve(getRecord({ model: modelCode, id: recordId }))
      .then((record) => form.setValues(record))
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setLoading(false));
  }, [form, mode, modelCode, recordId]);

  const close = () => {
    if (onCancel) onCancel();
    else navigate(recordListRoute(modelCode));
  };

  const save = async () => {
    setError(undefined);
    setSaving(true);
    try {
      const values = await form.submit<Record<string, unknown>>();
      if (!submit) throw new Error("record-form.props.submit 未配置");
      await submit(values, { mode, modelCode, recordId });
      message.success(mode === "add" ? "创建成功" : "保存成功");
      if (onSaved) await onSaved();
      else navigate(recordListRoute(modelCode));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({ submit: save }));

  const footer = (
    <Space>
      <Button icon={embedded ? undefined : <ArrowLeftOutlined />} onClick={close}>
        {embedded ? "取消" : "返回"}
      </Button>
      {mode !== "detail" && (
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void save()}>
          {ok ?? (mode === "add" ? "创建" : "保存")}
        </Button>
      )}
    </Space>
  );

  if (loading) {
    return (
      <div className={`${styles.actionBody} ${styles.actionLoading}`}>
        <Spin />
      </div>
    );
  }

  const body = (
    <div className={embedded ? styles.overlayBody : styles.actionBody}>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
      <FormRenderer form={form} nodes={compiled.nodes} domain={modelCode} />
    </div>
  );

  if (embedded) return body;
  return (
    <>
      {body}
      <div className={styles.actionFooterRoot}>
        <div className={styles.actionFooter}>{footer}</div>
      </div>
    </>
  );
});
