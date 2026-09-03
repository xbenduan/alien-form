import { SaveOutlined } from "@ant-design/icons";
import { App, Alert, Button, Card, Flex, Skeleton, Space, Steps } from "antd";
import { useEffect, useMemo, useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRuntime } from "@binding";
import type { BuilderSchema } from "@engine";
import { PageBreadcrumb } from "../../../components";
import { transport } from "@runtime/transport";
import {
  createDefaultDraft,
  decodeModel,
  encodeModel,
  reduceModel,
  type ModelDraft,
} from "../builder";
import { BasicInfo } from "./basic-info";
import { DatabaseBuilder } from "./database-builder";
import { FormBuilder } from "./form-builder";
import styles from "./index.module.css";

const STEP_TITLES = ["基本信息", "数据库构建", "表单配置"] as const;

export function ModelEditor({ modelCode, copyFrom }: { modelCode?: string; copyFrom?: string }) {
  const runtime = useRuntime();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const sourceModelCode = modelCode ?? copyFrom;
  const isCopy = Boolean(copyFrom);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(sourceModelCode));
  const [error, setError] = useState<string>();
  const initialDraft = useMemo(() => createDefaultDraft(runtime), [runtime]);
  const [draft, dispatch] = useReducer(reduceModel, initialDraft);

  useEffect(() => {
    if (!sourceModelCode) return;
    void transport
      .send<BuilderSchema>(`/api/schemas/${sourceModelCode}`)
      .then((model) => {
        const decoded = decodeModel(model);
        const next: ModelDraft = isCopy
          ? { ...decoded, name: `${decoded.name}_copy`, title: `${decoded.title}副本` }
          : decoded;
        dispatch({ type: "replace", draft: next });
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setLoading(false));
  }, [isCopy, sourceModelCode]);

  const save = async () => {
    setError(undefined);
    setSaving(true);
    try {
      const model = encodeModel(draft);
      await transport.send<BuilderSchema>(modelCode ? `/api/schemas/${modelCode}` : "/api/schemas", {
        method: modelCode ? "PUT" : "POST",
        body: JSON.stringify(model),
      });
      message.success(modelCode ? "模型保存成功" : isCopy ? "模型复制成功" : "模型创建成功");
      navigate("/models");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  };

  const validateStep = (): boolean => {
    if (step === 0 && (!draft.name.trim() || !draft.title.trim())) {
      message.error("请填写模型名与标题");
      return false;
    }
    return true;
  };

  return (
    <Flex className={styles.actionsPage} vertical gap={16}>
      <PageBreadcrumb
        items={[
          { title: "模型管理", to: "/models" },
          { title: modelCode ? "编辑模型" : isCopy ? "复制模型" : "新增模型" },
        ]}
      />
      <Card className={styles.stepCard}>
        <Steps current={step} items={STEP_TITLES.map((title) => ({ title }))} />
      </Card>
      {error && <Alert type="error" message={error} showIcon />}
      <Card className={styles.editorCard} title={STEP_TITLES[step]}>
        {loading ? (
          <Skeleton active />
        ) : step === 0 ? (
          <BasicInfo draft={draft} dispatch={dispatch} lockName={Boolean(modelCode)} />
        ) : step === 1 ? (
          <DatabaseBuilder draft={draft} runtime={runtime} dispatch={dispatch} />
        ) : (
          <FormBuilder draft={draft} dispatch={dispatch} />
        )}
      </Card>
      <div className={styles.footer}>
        <Space>
          <Button onClick={() => navigate("/models")}>取消</Button>
          {step > 0 && <Button onClick={() => setStep((current) => current - 1)}>上一步</Button>}
          {step < STEP_TITLES.length - 1 ? (
            <Button
              type="primary"
              onClick={() => {
                if (validateStep()) setStep((current) => current + 1);
              }}
            >
              下一步
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => void save()}
            >
              {modelCode ? "保存模型" : isCopy ? "复制模型" : "创建模型"}
            </Button>
          )}
        </Space>
      </div>
    </Flex>
  );
}
