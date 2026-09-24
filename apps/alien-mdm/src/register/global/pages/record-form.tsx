import { useCreateForm } from "@alien-form/react";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { App, Button, Space, Spin } from "antd";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FormRenderer, useRuntime } from "@alien-form/react";
import { compileForm, type AlienFieldSchema } from "@alien-form/engine";
import { AppCard } from "../../../components/app-card";
import { PageActionBar } from "../../../components/page-action-bar";
import { recordListRoute } from "@utils/record-route";
import styles from "./record-form.module.css";

export type RecordActionMode = "add" | "edit" | "detail";

interface RecordFormProps {
  mode: RecordActionMode;
  modelCode: string;
  recordId?: string;
  schema: AlienFieldSchema;
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

type GetRecord = (request: {
  model: string;
  id: string;
}) => Record<string, unknown> | Promise<Record<string, unknown>>;

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
  const compiled = useMemo(
    () => compileForm({ properties: schema.properties ?? {} }, { "form-schema": schema }),
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
    const service = form.scope.$service as (code: string) => GetRecord;
    void Promise.resolve()
      .then(() => service("records.get")({ model: modelCode, id: recordId }))
      .then((record) => form.setFieldsValue(record))
      .catch((reason) => message.error(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setLoading(false));
  }, [form, message, mode, modelCode, recordId]);

  const close = () => {
    if (onCancel) onCancel();
    else navigate(recordListRoute(modelCode));
  };

  const save = async () => {
    setSaving(true);
    try {
      const values = await form.submit<Record<string, unknown>>();
      if (!submit) throw new Error("record-form.props.submit 未配置");
      await submit(values, { mode, modelCode, recordId });
      message.success(mode === "add" ? "创建成功" : "保存成功");
      if (onSaved) await onSaved();
      else navigate(recordListRoute(modelCode));
    } catch (reason) {
      if (reason instanceof Error && reason.name === "FormValidationError") {
        focusFirstInvalidField(form);
      } else {
        message.error(reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      setSaving(false);
    }
  };

  function focusFirstInvalidField(currentForm: typeof form): void {
    const field = Array.from(currentForm.fields().values()).find(
      (item) => item.errors().length > 0,
    );
    if (!field) return;
    const target = Array.from(
      document.querySelectorAll<HTMLElement>("[data-alien-form-field]"),
    ).find((element) => element.dataset.alienFormField === field.path);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.focus({ preventScroll: true });
  }

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
    if (embedded) {
      return (
        <div className={`${styles.overlayBody} ${styles.actionLoading}`}>
          <Spin />
        </div>
      );
    }
    return (
      <AppCard className={styles.actionBody} classNames={{ body: styles.actionLoading }}>
        <Spin />
      </AppCard>
    );
  }

  const content = (
    <>
      <FormRenderer form={form} nodes={compiled.nodes} domain={modelCode} />
    </>
  );

  if (embedded) return <div className={styles.overlayBody}>{content}</div>;
  return (
    <>
      <AppCard className={styles.actionBody} classNames={{ body: styles.actionContent }}>
        {content}
      </AppCard>
      <PageActionBar>{footer}</PageActionBar>
    </>
  );
});
