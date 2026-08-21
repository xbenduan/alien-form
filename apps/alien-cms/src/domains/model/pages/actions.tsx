import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EyeOutlined, SaveOutlined } from "@ant-design/icons";
import { App, Button, Card, Col, Flex, Row, Space, Steps } from "antd";
import { PageBreadcrumb, PageError, PageLoading, FieldsetCard } from "../../../components";
import { modelListPath } from "../../../app/router/paths";
import { CompilerProvider } from "../../../compiler";
import { useModelBuilder } from "../hooks";
import {
  FieldListEditor,
  GroupEditor,
  ModelMetaForm,
  SchemaJsonEditor,
  SchemaPreview,
} from "../components";
import styles from "./index.module.css";

const STEPS = [{ title: "字段" }, { title: "分组与元信息" }, { title: "预览保存" }];

interface ModelActionPageProps {
  mode: "add" | "edit";
}

/** 模型构建页（新开页面）：add / edit 共用，由 mode 区分。 */
export default function ModelActionPage({ mode }: ModelActionPageProps) {
  return (
    <CompilerProvider>
      <ModelActionContent mode={mode} />
    </CompilerProvider>
  );
}

function ModelActionContent({ mode }: ModelActionPageProps) {
  const navigate = useNavigate();
  const { modelName } = useParams();
  const { message } = App.useApp();
  const builder = useModelBuilder(mode === "edit" ? modelName : undefined);
  const [step, setStep] = useState(0);
  if (builder.loading) return <PageLoading />;
  if (builder.loadError) {
    return <PageError title="模型加载失败" description={builder.loadError.message} />;
  }

  const handleSave = async () => {
    if (!builder.draft.name.trim()) {
      message.error("请填写模型名");
      return;
    }
    if (!/^[a-z][a-z0-9-]*$/.test(builder.draft.name.trim())) {
      message.error("模型名仅支持小写字母、数字和中划线，且以字母开头");
      return;
    }
    if (builder.preview.error) {
      message.error(builder.preview.error);
      return;
    }
    try {
      await builder.save();
      message.success(mode === "edit" ? "模型保存成功" : "模型创建成功");
      navigate(modelListPath());
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    }
  };

  return (
    <Flex className={`${styles.actionsPage} ${styles.page}`} vertical gap={16}>
      <PageBreadcrumb
        items={[
          { title: "模型管理", to: modelListPath() },
          { title: mode === "edit" ? "编辑模型" : "新增模型" },
        ]}
      />
      <Card styles={{ body: { padding: 20 } }}>
        <Steps current={step} items={STEPS} />
      </Card>

      <div className={styles.body}>
        {step === 0 ? (
          <Row gutter={16} align="stretch" className={styles.fieldsStep}>
            <Col span={8} className={styles.fill}>
              <FieldsetCard title="字段列表" className={styles.fill}>
                <FieldListEditor
                  fields={builder.draft.fields}
                  onChange={(fields) => builder.setDraft({ ...builder.draft, fields })}
                />
              </FieldsetCard>
            </Col>
            <Col span={16} className={styles.fill}>
              <FieldsetCard title="Schema" className={styles.fill}>
                <SchemaJsonEditor schema={builder.preview.schema} onApply={builder.setDraft} />
              </FieldsetCard>
            </Col>
          </Row>
        ) : null}

        {step === 1 ? (
          <div className={styles.configStack}>
            <FieldsetCard title="模型信息">
              <ModelMetaForm
                draft={builder.draft}
                nameDisabled={mode === "edit"}
                onChange={builder.setDraft}
              />
            </FieldsetCard>
            <FieldsetCard title="表单分组">
              <GroupEditor
                groups={builder.draft.groups}
                fields={builder.draft.fields}
                onChange={(groups) => builder.setDraft({ ...builder.draft, groups })}
              />
            </FieldsetCard>
          </div>
        ) : null}

        {step === 2 ? (
          <SchemaPreview schema={builder.preview.schema} error={builder.preview.error} />
        ) : null}
      </div>

      <div className={styles.footer}>
        <Space>
          <Button onClick={() => navigate(modelListPath())}>取消</Button>
          {step > 0 ? <Button onClick={() => setStep((s) => s - 1)}>上一步</Button> : null}
          {step < 2 ? (
            <Button type="primary" onClick={() => setStep((s) => s + 1)}>
              下一步
            </Button>
          ) : (
            <Button
              type="primary"
              icon={mode === "edit" ? <SaveOutlined /> : <EyeOutlined />}
              loading={builder.saving}
              onClick={handleSave}
            >
              {mode === "edit" ? "保存模型" : "创建模型"}
            </Button>
          )}
        </Space>
      </div>
    </Flex>
  );
}
