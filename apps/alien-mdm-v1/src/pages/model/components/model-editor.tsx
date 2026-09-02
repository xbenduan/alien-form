import { useCreateForm } from "@alien-form/react";
import { SaveOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Flex, Skeleton, Space, Steps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormRenderer, useRuntime } from "@binding";
import { compileForm, type BuilderSchema } from "@engine";
import { PageBreadcrumb } from "../../../components";
import { transport } from "@runtime/transport";
import {
  createDefaultPages,
  createModelCopyValues,
  decodeModel,
  encodeModel,
  retargetModelPages,
  type ModelEditorValues,
} from "../utils/model-codec";
import { defaultFields, defaultGroups, modelEditSchema } from "../utils/model-edit-schema";
import styles from "./index.module.css";

const STEPS = [
  {
    title: "基本信息",
    fields: [
      "modelCode",
      "title",
      "subtitle",
      "group",
      "singularLabel",
      "pluralLabel",
      "filterCount",
      "defaultPageSize",
      "addOpenMode",
      "editOpenMode",
      "detailOpenMode",
      "description",
    ],
  },
  { title: "表单信息", fields: ["fieldsJson", "groupsJson"] },
  { title: "页面构建", fields: ["pagesJson"] },
] as const;

const DEFAULT_VALUES: Partial<ModelEditorValues> = {
  group: "other",
  filterCount: 4,
  defaultPageSize: 20,
  addOpenMode: "drawer",
  editOpenMode: "drawer",
  detailOpenMode: "drawer",
  fieldsJson: JSON.stringify(defaultFields, null, 2),
  groupsJson: JSON.stringify(defaultGroups, null, 2),
  pagesJson: "",
};

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
  const [copyDraftModelCode, setCopyDraftModelCode] = useState<string>();
  const compiled = useMemo(
    () =>
      compileForm(
        { properties: modelEditSchema.properties ?? {} },
        { "form-schema": { type: "object", properties: {} } },
      ),
    [],
  );
  const form = useCreateForm(
    {
      schema: compiled.schema,
      initialValues: DEFAULT_VALUES,
      scope: runtime.createScope(undefined, {}),
    },
    [compiled.schema, runtime],
  );
  const visibleNodes = useMemo(() => {
    const fields = new Set<string>(STEPS[step].fields);
    return compiled.nodes.filter((node) => fields.has(node.key));
  }, [compiled.nodes, step]);

  useEffect(() => {
    if (!sourceModelCode) return;
    if (modelCode) form.field("modelCode")?.setDisabled(true);
    void transport
      .send<BuilderSchema>(`/api/schemas/${sourceModelCode}`)
      .then((model) => {
        const values = isCopy ? createModelCopyValues(model) : decodeModel(model);
        if (isCopy) setCopyDraftModelCode(values.modelCode);
        form.setValues(values);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setLoading(false));
  }, [form, isCopy, modelCode, sourceModelCode]);

  const validateCurrentStep = async (): Promise<boolean> => {
    const errors = await Promise.all(
      STEPS[step].fields.map((key) => form.field(key)?.validate() ?? Promise.resolve([])),
    );
    if (errors.some((items) => items.length > 0)) return false;
    try {
      const values = form.values() as ModelEditorValues;
      if (step === 1) {
        encodeModel({ ...values, pagesJson: undefined });
      }
      if (step === 2) {
        const pages = JSON.parse(values.pagesJson || "[]");
        if (!Array.isArray(pages)) throw new Error("页面 JSON 必须是数组");
      }
      return true;
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : String(reason));
      return false;
    }
  };

  const next = async () => {
    if (!(await validateCurrentStep())) return;
    if (step === 1) {
      const values = form.values() as ModelEditorValues;
      if (!values.pagesJson?.trim()) {
        form.set(
          "pagesJson",
          JSON.stringify(createDefaultPages(values.modelCode, values.title), null, 2),
        );
      }
    }
    setStep((current) => current + 1);
  };

  const save = async () => {
    if (!(await validateCurrentStep())) return;
    setError(undefined);
    setSaving(true);
    try {
      const values = form.values() as ModelEditorValues;
      let model = encodeModel(values);
      if (copyDraftModelCode && copyDraftModelCode !== model.meta.name) {
        model = {
          ...model,
          "x-pages": retargetModelPages(model["x-pages"], copyDraftModelCode, model.meta.name),
        };
      }
      await transport.send<BuilderSchema>(
        modelCode ? `/api/schemas/${modelCode}` : "/api/schemas",
        {
          method: modelCode ? "PUT" : "POST",
          body: JSON.stringify(model),
        },
      );
      message.success(modelCode ? "模型保存成功" : isCopy ? "模型复制成功" : "模型创建成功");
      navigate("/models");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  };

  const stepClass =
    step === 0
      ? styles.basicGrid
      : step === 1
        ? `${styles.formJsonGrid} ${styles.jsonEditor}`
        : styles.jsonEditor;

  return (
    <Flex className={styles.actionsPage} vertical gap={16}>
      <PageBreadcrumb
        items={[
          { title: "模型管理", to: "/models" },
          { title: modelCode ? "编辑模型" : isCopy ? "复制模型" : "新增模型" },
        ]}
      />
      <Card className={styles.stepCard}>
        <Steps current={step} items={STEPS.map(({ title }) => ({ title }))} />
      </Card>
      {error && <Alert type="error" title={error} showIcon />}
      <Card className={`${styles.editorCard} ${stepClass}`} title={STEPS[step].title}>
        {loading ? (
          <Skeleton active />
        ) : (
          <FormRenderer form={form} nodes={visibleNodes} domain={sourceModelCode} />
        )}
      </Card>
      <div className={styles.footer}>
        <Space>
          <Button onClick={() => navigate("/models")}>取消</Button>
          {step > 0 && <Button onClick={() => setStep((current) => current - 1)}>上一步</Button>}
          {step < STEPS.length - 1 ? (
            <Button type="primary" onClick={() => void next()}>
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
